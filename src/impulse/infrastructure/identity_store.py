"""PostgreSQL adapter for identity, server sessions and consent projections."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from impulse.api.errors import ApiError
from impulse.application.identity import (
    IdentityStore,
    ParticipantProfile,
    PersonaRecord,
    ProfileSkill,
    SessionRecord,
)
from impulse.domain.identity import (
    HR_VISIBILITY_DEFAULTS,
    HR_VISIBILITY_SCOPES,
    ConsentScope,
    Role,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.identity import (
    actor_roles,
    consents,
    persons,
    profile_skills,
    sessions,
    visibility_settings,
)
from impulse.infrastructure.models.insight import audit_entries, domain_events


class SqlIdentityStore(IdentityStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_personas(self) -> tuple[PersonaRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(
                        persons.c.id,
                        persons.c.external_key,
                        persons.c.display_name,
                        actor_roles.c.role,
                        actor_roles.c.program_key,
                    )
                    .join(actor_roles, actor_roles.c.person_id == persons.c.id)
                    .where(persons.c.external_key.like("demo:%"))
                    .order_by(persons.c.external_key, actor_roles.c.created_at)
                )
            ).all()
        grouped: dict[UUID, PersonaRecord] = {}
        for person_id, external_key, display_name, role, program_key in rows:
            parsed_role = Role(role)
            current = grouped.get(person_id)
            if current is None:
                grouped[person_id] = PersonaRecord(
                    person_id=person_id,
                    key=external_key.removeprefix("demo:"),
                    display_name=display_name,
                    roles=(parsed_role,),
                    program_key=program_key,
                )
            else:
                grouped[person_id] = PersonaRecord(
                    person_id=current.person_id,
                    key=current.key,
                    display_name=current.display_name,
                    roles=(*current.roles, parsed_role),
                    program_key=current.program_key,
                )
        ordered: list[PersonaRecord] = []
        for persona in grouped.values():
            roles = tuple(
                sorted(
                    persona.roles,
                    key=lambda role: (not persona.key.startswith(f"{role.value}-"), role.value),
                )
            )
            ordered.append(
                PersonaRecord(
                    person_id=persona.person_id,
                    key=persona.key,
                    display_name=persona.display_name,
                    roles=roles,
                    program_key=persona.program_key,
                )
            )
        return tuple(ordered)

    async def get_persona(self, key: str) -> PersonaRecord | None:
        return next((item for item in await self.list_personas() if item.key == key), None)

    async def get_persona_by_id(self, person_id: UUID) -> PersonaRecord | None:
        return next(
            (item for item in await self.list_personas() if item.person_id == person_id), None
        )

    async def create_session(self, record: SessionRecord) -> None:
        async with self.database.session() as session:
            await session.execute(
                insert(sessions).values(
                    id=record.session_id,
                    person_id=record.person_id,
                    token_digest=record.token_digest,
                    expires_at=record.expires_at,
                    status="active",
                    data_origin="demo_runtime",
                    payload={
                        "active_role": record.active_role.value,
                        "csrf_digest": record.csrf_digest,
                    },
                    created_by=record.person_id,
                )
            )

    async def get_session(self, token_digest: str) -> SessionRecord | None:
        async with self.database.sessions() as session:
            row = (
                (
                    await session.execute(
                        select(sessions).where(sessions.c.token_digest == token_digest)
                    )
                )
                .mappings()
                .one_or_none()
            )
        if row is None:
            return None
        payload = row["payload"]
        return SessionRecord(
            session_id=row["id"],
            person_id=row["person_id"],
            token_digest=row["token_digest"],
            csrf_digest=str(payload["csrf_digest"]),
            active_role=Role(payload["active_role"]),
            expires_at=row["expires_at"],
            revoked=row["status"] != "active",
        )

    async def set_active_role(self, session_id: UUID, role: Role) -> None:
        async with self.database.session() as session:
            row = (
                (await session.execute(select(sessions).where(sessions.c.id == session_id)))
                .mappings()
                .one()
            )
            payload = {**row["payload"], "active_role": role.value}
            await session.execute(
                update(sessions)
                .where(sessions.c.id == session_id)
                .values(payload=payload, version=sessions.c.version + 1)
            )

    async def revoke_session(self, session_id: UUID) -> None:
        async with self.database.session() as session:
            await session.execute(
                update(sessions)
                .where(sessions.c.id == session_id)
                .values(status="revoked", version=sessions.c.version + 1)
            )

    async def granted_consents(self, person_id: UUID) -> frozenset[ConsentScope]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(consents.c.scope, consents.c.granted, consents.c.version)
                    .where(consents.c.person_id == person_id)
                    .order_by(consents.c.scope, consents.c.version.desc())
                )
            ).all()
        latest: dict[str, bool] = {}
        for scope, granted, _version in rows:
            latest.setdefault(scope, granted)
        return frozenset(ConsentScope(scope) for scope, granted in latest.items() if granted)

    async def set_consent(
        self, person_id: UUID, scope: ConsentScope, granted: bool
    ) -> frozenset[ConsentScope]:
        async with self.database.session() as session:
            current_version = int(
                await session.scalar(
                    select(func.max(consents.c.version)).where(
                        consents.c.person_id == person_id,
                        consents.c.scope == scope.value,
                    )
                )
                or 0
            )
            version = current_version + 1
            consent_id = UUID(
                bytes=hashlib.sha256(f"{person_id}:{scope.value}:{version}".encode()).digest()[:16]
            )
            await session.execute(
                insert(consents).values(
                    id=consent_id,
                    person_id=person_id,
                    scope=scope.value,
                    granted=granted,
                    version=version,
                    data_origin="demo_runtime",
                    created_by=person_id,
                    provenance={"source": "self_service"},
                )
            )
            await session.execute(
                postgres_insert(visibility_settings)
                .values(
                    person_id=person_id,
                    scope=scope.value,
                    visible=granted,
                    data_origin="demo_runtime",
                    created_by=person_id,
                )
                .on_conflict_do_update(
                    constraint="uq_visibility_settings_person_id_scope",
                    set_={
                        "visible": granted,
                        "version": visibility_settings.c.version + 1,
                        "updated_at": datetime.now(UTC),
                    },
                )
            )
            await session.execute(
                insert(audit_entries).values(
                    action="consent.granted" if granted else "consent.revoked",
                    entity_type="consent",
                    entity_id=consent_id,
                    entity_version=version,
                    actor_id=None,
                    created_by=person_id,
                    data_origin="demo_runtime",
                    payload={"scope": scope.value},
                )
            )
            await session.execute(
                postgres_insert(domain_events)
                .values(
                    event_key=f"consent:{person_id}:{scope.value}:v{version}",
                    event_type="identity.consent_changed",
                    schema_version=1,
                    entity_type="consent",
                    entity_id=consent_id,
                    entity_version=version,
                    occurred_at=datetime.now(UTC),
                    created_by=person_id,
                    data_origin="human",
                    payload={"scope": scope.value, "granted": granted},
                )
                .on_conflict_do_nothing(constraint="uq_domain_events_event_key")
            )
        return await self.granted_consents(person_id)

    async def hr_visibility(self, person_id: UUID) -> dict[str, bool]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(visibility_settings.c.scope, visibility_settings.c.visible).where(
                        visibility_settings.c.person_id == person_id,
                        visibility_settings.c.scope.in_(HR_VISIBILITY_SCOPES),
                    )
                )
            ).all()
            stored = {row.scope: bool(row.visible) for row in rows}
            return {
                scope: stored.get(scope, HR_VISIBILITY_DEFAULTS[scope])
                for scope in HR_VISIBILITY_SCOPES
            }

    async def set_hr_visibility(self, person_id: UUID, scope: str, visible: bool) -> bool:
        async with self.database.session() as session:
            current_version = int(
                await session.scalar(
                    select(func.max(visibility_settings.c.version)).where(
                        visibility_settings.c.person_id == person_id,
                        visibility_settings.c.scope == scope,
                    )
                )
                or 0
            )
            await session.execute(
                postgres_insert(visibility_settings)
                .values(
                    person_id=person_id,
                    scope=scope,
                    visible=visible,
                    data_origin="demo_runtime",
                    created_by=person_id,
                )
                .on_conflict_do_update(
                    constraint="uq_visibility_settings_person_id_scope",
                    set_={
                        "visible": visible,
                        "version": visibility_settings.c.version + 1,
                        "updated_at": datetime.now(UTC),
                    },
                )
            )
            visibility_id = UUID(
                bytes=hashlib.sha256(f"visibility:{person_id}:{scope}".encode()).digest()[:16]
            )
            await session.execute(
                insert(audit_entries).values(
                    action="visibility.updated",
                    entity_type="visibility",
                    entity_id=visibility_id,
                    entity_version=current_version + 1,
                    actor_id=person_id,
                    created_by=person_id,
                    data_origin="demo_runtime",
                    payload={"scope": scope, "visible": visible},
                )
            )
        return visible

    async def participant_profile(self, person_id: UUID) -> ParticipantProfile | None:
        async with self.database.sessions() as session:
            person = (
                (await session.execute(select(persons).where(persons.c.id == person_id)))
                .mappings()
                .one_or_none()
            )
            if person is None:
                return None
            rows = (
                (
                    await session.execute(
                        select(profile_skills)
                        .where(profile_skills.c.person_id == person_id)
                        .order_by(profile_skills.c.verified.desc(), profile_skills.c.title)
                    )
                )
                .mappings()
                .all()
            )
        payload = person["payload"]
        return ParticipantProfile(
            person_id=person_id,
            display_name=person["display_name"],
            city=str(payload.get("city", "")),
            university=str(payload.get("university", "")),
            study_year=str(payload.get("study_year", "")),
            primary_track=str(payload.get("primary_track", "")),
            email=str(payload.get("email", "")),
            telegram=str(payload.get("telegram", "")),
            about=str(payload.get("about", "")),
            avatar_url=str(payload.get("avatar_url", "")),
            locale=str(payload.get("locale", "ru-RU")),
            theme=str(payload.get("theme", "dark")),
            timezone=str(payload.get("timezone", "Europe/Moscow")),
            buddy_enabled=bool(payload.get("buddy_enabled", True)),
            skills=tuple(
                ProfileSkill(row["title"], row["origin"], row["verified"]) for row in rows
            ),
        )

    async def update_participant_profile(self, profile: ParticipantProfile) -> ParticipantProfile:
        async with self.database.session() as session:
            current = (
                (await session.execute(select(persons).where(persons.c.id == profile.person_id)))
                .mappings()
                .one_or_none()
            )
            if current is None:
                raise ApiError("AUTH_REQUIRED", "Войдите в систему.", 401)
            payload = {
                **current["payload"],
                "city": profile.city,
                "university": profile.university,
                "study_year": profile.study_year,
                "primary_track": profile.primary_track,
                "email": profile.email,
                "telegram": profile.telegram,
                "about": profile.about,
                "avatar_url": profile.avatar_url,
                "locale": profile.locale,
                "theme": profile.theme,
                "timezone": profile.timezone,
                "buddy_enabled": profile.buddy_enabled,
            }
            await session.execute(
                update(persons)
                .where(persons.c.id == profile.person_id)
                .values(
                    display_name=profile.display_name,
                    payload=payload,
                    version=persons.c.version + 1,
                )
            )
            await session.execute(
                delete(profile_skills).where(
                    profile_skills.c.person_id == profile.person_id,
                    profile_skills.c.origin == "self_reported",
                )
            )
            for skill in profile.skills:
                await session.execute(
                    postgres_insert(profile_skills)
                    .values(
                        person_id=profile.person_id,
                        title=skill.title,
                        origin="self_reported",
                        verified=False,
                        data_origin="human",
                        provenance={"source": "profile_settings"},
                        created_by=profile.person_id,
                    )
                    .on_conflict_do_nothing(constraint="uq_profile_skills_person_id_title_origin")
                )
            profile_event_id = UUID(
                bytes=hashlib.sha256(
                    f"profile:{profile.person_id}:{int(current['version']) + 1}".encode()
                ).digest()[:16]
            )
            await session.execute(
                insert(audit_entries).values(
                    action="profile.updated",
                    entity_type="person",
                    entity_id=profile.person_id,
                    entity_version=int(current["version"]) + 1,
                    actor_id=profile.person_id,
                    created_by=profile.person_id,
                    data_origin="human",
                    payload={"changed_via": "profile_settings"},
                )
            )
            await session.execute(
                postgres_insert(domain_events)
                .values(
                    id=profile_event_id,
                    event_key=f"profile:{profile.person_id}:v{int(current['version']) + 1}",
                    event_type="identity.profile_updated",
                    schema_version=1,
                    entity_type="person",
                    entity_id=profile.person_id,
                    entity_version=int(current["version"]) + 1,
                    occurred_at=datetime.now(UTC),
                    created_by=profile.person_id,
                    data_origin="human",
                    payload={"locale": profile.locale, "timezone": profile.timezone},
                )
                .on_conflict_do_nothing(constraint="uq_domain_events_event_key")
            )
        refreshed = await self.participant_profile(profile.person_id)
        assert refreshed is not None
        return refreshed
