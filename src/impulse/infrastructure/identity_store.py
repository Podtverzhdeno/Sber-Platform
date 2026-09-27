"""PostgreSQL adapter for identity, server sessions and consent projections."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from impulse.application.identity import IdentityStore, PersonaRecord, SessionRecord
from impulse.domain.identity import ConsentScope, Role
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.identity import (
    actor_roles,
    consents,
    persons,
    sessions,
    visibility_settings,
)
from impulse.infrastructure.models.insight import audit_entries


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
        return await self.granted_consents(person_id)
