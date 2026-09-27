"""Demo authentication and consent use cases behind a storage contract."""

from __future__ import annotations

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from impulse.api.errors import ApiError
from impulse.domain.identity import (
    ROLE_NAVIGATION,
    ROLE_SCOPES,
    ActorContext,
    ConsentScope,
    Role,
)

SESSION_COOKIE = "impulse_session"


@dataclass(frozen=True, slots=True)
class PersonaRecord:
    person_id: UUID
    key: str
    display_name: str
    roles: tuple[Role, ...]
    program_key: str = "impulse-demo"


@dataclass(frozen=True, slots=True)
class SessionRecord:
    session_id: UUID
    person_id: UUID
    token_digest: str
    csrf_digest: str
    active_role: Role
    expires_at: datetime
    revoked: bool = False


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


class MemoryIdentityStore:
    """Zero-config demo adapter; production uses the SQL store."""

    def __init__(self, personas: tuple[PersonaRecord, ...]) -> None:
        self._personas = {persona.key: persona for persona in personas}
        self._sessions: dict[str, SessionRecord] = {}
        self._consents: dict[UUID, frozenset[ConsentScope]] = {}

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

    async def require_csrf(self, authenticated: AuthenticatedSession, csrf: str | None) -> None:
        if csrf is None or not secrets.compare_digest(
            authenticated.session.csrf_digest, self._digest(csrf)
        ):
            raise ApiError(
                code="CSRF_INVALID",
                message="Проверка запроса не пройдена.",
                status_code=403,
            )

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

    async def _actor(
        self, persona: PersonaRecord, role: Role, correlation_id: str = ""
    ) -> ActorContext:
        consents = await self.store.granted_consents(persona.person_id)
        return ActorContext(
            person_id=persona.person_id,
            display_name=persona.display_name,
            active_role=role,
            assigned_roles=persona.roles,
            scopes=ROLE_SCOPES[role],
            program_key=persona.program_key,
            consent_scopes=consents,
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
        ),
        PersonaRecord(
            identifier("manager-olga"),
            "manager-olga",
            "Ольга Руководитель",
            (Role.MANAGER, Role.CUSTOMER),
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
