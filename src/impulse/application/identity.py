"""Demo authentication and consent use cases behind a storage contract."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from impulse.api.errors import ApiError
from impulse.domain.identity import (
    HR_VISIBILITY_DEFAULTS,
    HR_VISIBILITY_SCOPES,
    ROLE_NAVIGATION,
    ROLE_SCOPES,
    ActorContext,
    ConsentScope,
    Role,
)

SESSION_COOKIE = "impulse_session"

CustomerVerificationState = Literal["demo", "unverified", "verified"]


@dataclass(frozen=True, slots=True)
class PersonaRecord:
    person_id: UUID
    key: str
    display_name: str
    roles: tuple[Role, ...]
    program_key: str = "impulse-demo"
    # Authoritative customer state; None keeps the legacy environment fallback
    # for synthetic stores that do not persist customer verification.
    customer_verification: CustomerVerificationState | None = None


@dataclass(frozen=True, slots=True)
class SessionRecord:
    session_id: UUID
    person_id: UUID
    token_digest: str
    csrf_digest: str
    active_role: Role
    expires_at: datetime
    revoked: bool = False


@dataclass(frozen=True, slots=True)
class ProfileSkill:
    title: str
    origin: str = "self_reported"
    verified: bool = False


@dataclass(frozen=True, slots=True)
class ParticipantProfile:
    person_id: UUID
    display_name: str
    city: str = ""
    university: str = ""
    study_year: str = ""
    primary_track: str = ""
    email: str = ""
    telegram: str = ""
    about: str = ""
    avatar_url: str = ""
    locale: str = "ru-RU"
    theme: str = "dark"
    timezone: str = "Europe/Moscow"
    buddy_enabled: bool = True
    skills: tuple[ProfileSkill, ...] = ()


class IdentityStore(Protocol):
    async def list_personas(self) -> tuple[PersonaRecord, ...]: ...

    async def get_persona(self, key: str) -> PersonaRecord | None: ...

    async def get_persona_by_id(self, person_id: UUID) -> PersonaRecord | None: ...

    async def create_session(self, record: SessionRecord) -> None: ...

    async def get_session(self, token_digest: str) -> SessionRecord | None: ...

    async def set_active_role(self, session_id: UUID, role: Role) -> None: ...

    async def revoke_session(self, session_id: UUID) -> None: ...

    async def granted_consents(self, person_id: UUID) -> frozenset[ConsentScope]: ...

    async def set_consent(
        self, person_id: UUID, scope: ConsentScope, granted: bool
    ) -> frozenset[ConsentScope]: ...

    async def hr_visibility(self, person_id: UUID) -> dict[str, bool]: ...

    async def set_hr_visibility(self, person_id: UUID, scope: str, visible: bool) -> bool: ...

    async def participant_profile(self, person_id: UUID) -> ParticipantProfile | None: ...

    async def update_participant_profile(
        self, profile: ParticipantProfile
    ) -> ParticipantProfile: ...


class MemoryIdentityStore:
    """Zero-config demo adapter; production uses the SQL store."""

    def __init__(self, personas: tuple[PersonaRecord, ...]) -> None:
        self._personas = {persona.key: persona for persona in personas}
        self._sessions: dict[str, SessionRecord] = {}
        self._consents: dict[UUID, frozenset[ConsentScope]] = {}
        self._profiles: dict[UUID, ParticipantProfile] = {}
        self._visibility: dict[tuple[UUID, str], bool] = {}

    async def list_personas(self) -> tuple[PersonaRecord, ...]:
        return tuple(self._personas.values())

    async def get_persona(self, key: str) -> PersonaRecord | None:
        return self._personas.get(key)

    async def get_persona_by_id(self, person_id: UUID) -> PersonaRecord | None:
        return next((item for item in self._personas.values() if item.person_id == person_id), None)

    async def create_session(self, record: SessionRecord) -> None:
        self._sessions[record.token_digest] = record

    async def get_session(self, token_digest: str) -> SessionRecord | None:
        return self._sessions.get(token_digest)

    async def set_active_role(self, session_id: UUID, role: Role) -> None:
        for digest, session in self._sessions.items():
            if session.session_id == session_id:
                self._sessions[digest] = replace(session, active_role=role)
                return

    async def revoke_session(self, session_id: UUID) -> None:
        for digest, session in self._sessions.items():
            if session.session_id == session_id:
                self._sessions[digest] = replace(session, revoked=True)
                return

    async def granted_consents(self, person_id: UUID) -> frozenset[ConsentScope]:
        return self._consents.get(person_id, frozenset())

    async def hr_visibility(self, person_id: UUID) -> dict[str, bool]:
        return {
            scope: self._visibility.get((person_id, scope), HR_VISIBILITY_DEFAULTS[scope])
            for scope in HR_VISIBILITY_SCOPES
        }

    async def set_hr_visibility(self, person_id: UUID, scope: str, visible: bool) -> bool:
        self._visibility[(person_id, scope)] = visible
        return visible

    async def set_consent(
        self, person_id: UUID, scope: ConsentScope, granted: bool
    ) -> frozenset[ConsentScope]:
        current = set(await self.granted_consents(person_id))
        if granted:
            current.add(scope)
        else:
            current.discard(scope)
        result = frozenset(current)
        self._consents[person_id] = result
        return result

    async def participant_profile(self, person_id: UUID) -> ParticipantProfile | None:
        stored = self._profiles.get(person_id)
        if stored is not None:
            return stored
        persona = await self.get_persona_by_id(person_id)
        if persona is None:
            return None
        skills = (
            (
                ProfileSkill("Python", "imported", False),
                ProfileSkill("SQL", "verified_course", True),
                ProfileSkill("OpenSpec / SDD", "verified_project", True),
            )
            if Role.PARTICIPANT in persona.roles
            else ()
        )
        return ParticipantProfile(person_id, persona.display_name, skills=skills)

    async def update_participant_profile(self, profile: ParticipantProfile) -> ParticipantProfile:
        persona = await self.get_persona_by_id(profile.person_id)
        if persona is None:
            raise ApiError("AUTH_REQUIRED", "Войдите в систему.", 401)
        current = await self.participant_profile(profile.person_id)
        preserved = tuple(
            item
            for item in (current.skills if current is not None else ())
            if item.origin != "self_reported"
        )
        stored = replace(profile, skills=(*preserved, *profile.skills))
        self._profiles[profile.person_id] = stored
        self._personas[persona.key] = replace(persona, display_name=profile.display_name)
        return stored


@dataclass(frozen=True, slots=True)
class AuthenticatedSession:
    actor: ActorContext
    session: SessionRecord


@dataclass(frozen=True, slots=True)
class LoginResult:
    authenticated: AuthenticatedSession
    signed_cookie: str
    csrf_token: str


class DemoAuthService:
    """Signed opaque sessions; authorization facts always come from server storage."""

    def __init__(
        self,
        store: IdentityStore,
        *,
        secret: str,
        ttl_seconds: int,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self.store = store
        self.ttl_seconds = ttl_seconds
        self._csrf_secret = secret.encode("utf-8")
        self._now = now or (lambda: datetime.now(UTC))
        self._signer = URLSafeTimedSerializer(secret_key=secret, salt="impulse-session-v1")

    @staticmethod
    def _digest(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def unauthenticated() -> ApiError:
        return ApiError(code="AUTH_REQUIRED", message="Войдите в систему.", status_code=401)

    async def list_personas(self) -> tuple[PersonaRecord, ...]:
        return await self.store.list_personas()

    async def login(self, persona_key: str) -> LoginResult:
        persona = await self.store.get_persona(persona_key)
        if persona is None:
            raise self.unauthenticated()
        token = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(24)
        session = SessionRecord(
            session_id=uuid4(),
            person_id=persona.person_id,
            token_digest=self._digest(token),
            csrf_digest=self._digest(csrf),
            active_role=persona.roles[0],
            expires_at=self._now() + timedelta(seconds=self.ttl_seconds),
        )
        await self.store.create_session(session)
        actor = await self._actor(persona, session.active_role)
        return LoginResult(
            authenticated=AuthenticatedSession(actor=actor, session=session),
            signed_cookie=self._signer.dumps(token),
            csrf_token=csrf,
        )

    async def authenticate(
        self, signed_cookie: str | None, *, correlation_id: str = ""
    ) -> AuthenticatedSession:
        if not signed_cookie:
            raise self.unauthenticated()
        try:
            token = self._signer.loads(signed_cookie, max_age=self.ttl_seconds)
        except (BadSignature, SignatureExpired):
            raise self.unauthenticated() from None
        if not isinstance(token, str):
            raise self.unauthenticated()
        session = await self.store.get_session(self._digest(token))
        if session is None or session.revoked or session.expires_at <= self._now():
            raise self.unauthenticated()
        persona = await self.store.get_persona_by_id(session.person_id)
        if persona is None or session.active_role not in persona.roles:
            raise self.unauthenticated()
        actor = await self._actor(persona, session.active_role, correlation_id=correlation_id)
        return AuthenticatedSession(actor=actor, session=session)

    def recoverable_csrf_token(self, authenticated: AuthenticatedSession) -> str:
        """Session-scoped CSRF for same-origin /me; never expose the cookie secret.

        The persisted original random token remains valid. This HMAC variant
        lets the SPA recover after reload/new tab without disabling CSRF.
        """
        digest = authenticated.session.token_digest
        return hmac.new(
            self._csrf_secret,
            f"impulse-csrf-v2:{digest}".encode(),
            hashlib.sha256,
        ).hexdigest()

    async def require_csrf(self, authenticated: AuthenticatedSession, csrf: str | None) -> None:
        recovered = self.recoverable_csrf_token(authenticated)
        stored_matches = csrf is not None and secrets.compare_digest(
            authenticated.session.csrf_digest, self._digest(csrf)
        )
        recovered_matches = csrf is not None and secrets.compare_digest(recovered, csrf)
        if not stored_matches and not recovered_matches:
            raise ApiError(
                code="CSRF_INVALID",
                message="Проверка запроса не пройдена.",
                status_code=403,
            )

    async def save_theme(self, authenticated: AuthenticatedSession, theme: str) -> ActorContext:
        if theme not in {"dark", "light", "system"}:
            raise ApiError("PROFILE_THEME_UNSUPPORTED", "Тема не поддерживается.", 422)
        if authenticated.actor.active_role is not Role.PARTICIPANT:
            return authenticated.actor
        profile = await self.store.participant_profile(authenticated.actor.person_id)
        if profile is None:
            return authenticated.actor
        await self.store.update_participant_profile(replace(profile, theme=theme))
        return authenticated.actor

    async def switch_role(self, authenticated: AuthenticatedSession, role: Role) -> ActorContext:
        if role not in authenticated.actor.assigned_roles:
            raise ApiError(
                code="ROLE_NOT_ASSIGNED",
                message="Эта роль не назначена пользователю.",
                status_code=403,
            )
        await self.store.set_active_role(authenticated.session.session_id, role)
        persona = await self.store.get_persona_by_id(authenticated.actor.person_id)
        if persona is None:
            raise self.unauthenticated()
        return await self._actor(persona, role, authenticated.actor.correlation_id)

    async def logout(self, authenticated: AuthenticatedSession) -> None:
        await self.store.revoke_session(authenticated.session.session_id)

    async def set_consent(
        self,
        authenticated: AuthenticatedSession,
        scope: ConsentScope,
        granted: bool,
    ) -> frozenset[ConsentScope]:
        if authenticated.actor.active_role is not Role.PARTICIPANT:
            raise ApiError(
                code="FORBIDDEN",
                message="Действие недоступно для активной роли.",
                status_code=403,
            )
        return await self.store.set_consent(authenticated.actor.person_id, scope, granted)

    @staticmethod
    def _participant_only(authenticated: AuthenticatedSession) -> None:
        if authenticated.actor.active_role is not Role.PARTICIPANT:
            raise ApiError(
                code="FORBIDDEN",
                message="Действие недоступно для активной роли.",
                status_code=403,
            )

    async def hr_visibility(self, authenticated: AuthenticatedSession) -> dict[str, bool]:
        self._participant_only(authenticated)
        return await self.store.hr_visibility(authenticated.actor.person_id)

    async def set_hr_visibility(
        self, authenticated: AuthenticatedSession, scope: str, visible: bool
    ) -> dict[str, bool]:
        self._participant_only(authenticated)
        if scope not in HR_VISIBILITY_SCOPES:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        consents = await self.store.granted_consents(authenticated.actor.person_id)
        if visible and ConsentScope.HR_PROFILE not in consents:
            raise ApiError(
                code="HR_VISIBILITY_LOCKED",
                message="Сначала откройте профиль для HR на вкладке «Видимость для HR».",
                status_code=409,
            )
        await self.store.set_hr_visibility(authenticated.actor.person_id, scope, visible)
        return await self.store.hr_visibility(authenticated.actor.person_id)

    async def participant_profile(self, authenticated: AuthenticatedSession) -> ParticipantProfile:
        self._participant_only(authenticated)
        profile = await self.store.participant_profile(authenticated.actor.person_id)
        if profile is None:
            raise self.unauthenticated()
        return profile

    async def update_participant_profile(
        self, authenticated: AuthenticatedSession, profile: ParticipantProfile
    ) -> ParticipantProfile:
        self._participant_only(authenticated)
        if profile.person_id != authenticated.actor.person_id:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        if profile.locale not in {"ru-RU", "en-US"}:
            raise ApiError("PROFILE_LOCALE_UNSUPPORTED", "Язык не поддерживается.", 422)
        if profile.theme not in {"dark", "light", "system"}:
            raise ApiError("PROFILE_THEME_UNSUPPORTED", "Тема не поддерживается.", 422)
        try:
            ZoneInfo(profile.timezone)
        except ZoneInfoNotFoundError:
            raise ApiError(
                "PROFILE_TIMEZONE_UNSUPPORTED", "Часовой пояс не поддерживается.", 422
            ) from None
        normalized = replace(
            profile,
            display_name=profile.display_name.strip(),
            skills=tuple(
                ProfileSkill(item.title.strip(), "self_reported", False)
                for item in profile.skills
                if item.title.strip()
            ),
        )
        if not normalized.display_name:
            raise ApiError("PROFILE_NAME_REQUIRED", "Укажите ФИО.", 422)
        return await self.store.update_participant_profile(normalized)

    async def _actor(
        self, persona: PersonaRecord, role: Role, correlation_id: str = ""
    ) -> ActorContext:
        consents = await self.store.granted_consents(persona.person_id)
        profile = await self.store.participant_profile(persona.person_id)
        return ActorContext(
            person_id=persona.person_id,
            display_name=persona.display_name,
            active_role=role,
            assigned_roles=persona.roles,
            scopes=ROLE_SCOPES[role],
            program_key=persona.program_key,
            consent_scopes=consents,
            locale=profile.locale if profile is not None else "ru-RU",
            timezone=profile.timezone if profile is not None else "Europe/Moscow",
            correlation_id=correlation_id,
        )


def demo_personas() -> tuple[PersonaRecord, ...]:
    """Stable personas also used when PostgreSQL is intentionally omitted."""
    namespace = UUID("6c3775de-88fa-4d98-a584-cf7820422d54")

    def identifier(key: str) -> UUID:
        from uuid import uuid5

        return uuid5(namespace, f"v1:{key}")

    return (
        PersonaRecord(
            identifier("participant-alex"),
            "participant-alex",
            "Алекс Речной",
            (Role.PARTICIPANT,),
        ),
        PersonaRecord(
            identifier("participant-maria"),
            "participant-maria",
            "Мария Северова",
            (Role.PARTICIPANT,),
        ),
        PersonaRecord(
            identifier("participant-igor"),
            "participant-igor",
            "Игорь Лесной",
            (Role.PARTICIPANT,),
        ),
        PersonaRecord(
            identifier("mentor-elena"),
            "mentor-elena",
            "Елена Наставник",
            (Role.MENTOR,),
        ),
        PersonaRecord(
            identifier("customer-roman"),
            "customer-roman",
            "Роман Заказчик",
            (Role.CUSTOMER,),
            customer_verification="demo",
        ),
        PersonaRecord(
            identifier("manager-olga"),
            "manager-olga",
            "Ольга Руководитель",
            (Role.MANAGER, Role.CUSTOMER),
            customer_verification="unverified",
        ),
        PersonaRecord(identifier("hr-nina"), "hr-nina", "Нина HR", (Role.HR,)),
        PersonaRecord(
            identifier("operator-pavel"),
            "operator-pavel",
            "Павел Оператор",
            (Role.OPERATOR,),
        ),
    )


def navigation_for(actor: ActorContext) -> tuple[str, ...]:
    return ROLE_NAVIGATION[actor.active_role]
