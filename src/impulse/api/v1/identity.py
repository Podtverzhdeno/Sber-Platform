"""Versioned identity API for demo login, role selection and consent."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from pydantic import BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.request_context import get_request_id
from impulse.application.identity import (
    SESSION_COOKIE,
    AuthenticatedSession,
    DemoAuthService,
    PersonaRecord,
    navigation_for,
)
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.identity import ConsentScope, Role

router = APIRouter()


class PersonaView(BaseModel):
    key: str
    display_name: str
    roles: list[Role]


class DemoLoginRequest(BaseModel):
    persona_key: str = Field(min_length=1, max_length=80)


class ActorView(BaseModel):
    person_id: UUID
    display_name: str
    active_role: Role
    assigned_roles: list[Role]
    scopes: list[str]
    consent_scopes: list[ConsentScope]
    navigation: list[str]
    csrf_token: str | None = None


class SwitchRoleRequest(BaseModel):
    role: Role


class ConsentRequest(BaseModel):
    granted: bool


class ConsentView(BaseModel):
    scope: ConsentScope
    granted: bool
    granted_scopes: list[ConsentScope]


def _service(request: Request) -> DemoAuthService:
    return request.app.state.auth_service


async def current_session(
    request: Request,
    service: Annotated[DemoAuthService, Depends(_service)],
) -> AuthenticatedSession:
    return await service.authenticate(
        request.cookies.get(SESSION_COOKIE), correlation_id=get_request_id()
    )


async def csrf_session(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
    csrf_token: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> AuthenticatedSession:
    await service.require_csrf(authenticated, csrf_token)
    return authenticated


def _actor_view(authenticated: AuthenticatedSession, csrf_token: str | None = None) -> ActorView:
    actor = authenticated.actor
    return ActorView(
        person_id=actor.person_id,
        display_name=actor.display_name,
        active_role=actor.active_role,
        assigned_roles=list(actor.assigned_roles),
        scopes=sorted(actor.scopes),
        consent_scopes=sorted(actor.consent_scopes),
        navigation=list(navigation_for(actor)),
        csrf_token=csrf_token,
    )


def _persona_view(persona: PersonaRecord) -> PersonaView:
    return PersonaView(
        key=persona.key,
        display_name=persona.display_name,
        roles=list(persona.roles),
    )


@router.get("/auth/personas", response_model=list[PersonaView])
async def personas(
    request: Request,
    service: Annotated[DemoAuthService, Depends(_service)],
) -> list[PersonaView]:
    settings: Settings = request.app.state.settings
    if not settings.demo_mode:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    return [_persona_view(item) for item in await service.list_personas()]


@router.post("/auth/demo-login", response_model=ActorView)
async def demo_login(
    command: DemoLoginRequest,
    request: Request,
    response: Response,
    service: Annotated[DemoAuthService, Depends(_service)],
) -> ActorView:
    settings: Settings = request.app.state.settings
    if not settings.demo_mode:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    result = await service.login(command.persona_key)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=result.signed_cookie,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.app_env is AppEnvironment.PRODUCTION,
        samesite="lax",
        path="/",
    )
    return _actor_view(result.authenticated, result.csrf_token)


@router.get("/me", response_model=ActorView)
async def me(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> ActorView:
    return _actor_view(authenticated)


@router.post("/me/active-role", response_model=ActorView)
async def switch_role(
    command: SwitchRoleRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> ActorView:
    actor = await service.switch_role(authenticated, command.role)
    return _actor_view(AuthenticatedSession(actor=actor, session=authenticated.session))


@router.put("/me/consents/{scope}", response_model=ConsentView)
async def set_consent(
    scope: ConsentScope,
    command: ConsentRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> ConsentView:
    granted_scopes = await service.set_consent(authenticated, scope, command.granted)
    return ConsentView(
        scope=scope,
        granted=command.granted,
        granted_scopes=sorted(granted_scopes),
    )


@router.post("/auth/logout", status_code=204)
async def logout(
    response: Response,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> None:
    await service.logout(authenticated)
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
