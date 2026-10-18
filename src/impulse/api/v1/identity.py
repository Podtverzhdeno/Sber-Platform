"""Versioned identity API for demo login, role selection and consent."""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from pydantic import BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.request_context import get_request_id
from impulse.application.identity import (
    SESSION_COOKIE,
    AuthenticatedSession,
    DemoAuthService,
    ParticipantProfile,
    PersonaRecord,
    ProfileSkill,
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
    locale: str
    timezone: str
    csrf_token: str | None = None


class SwitchRoleRequest(BaseModel):
    role: Role


class ConsentRequest(BaseModel):
    granted: bool


class ConsentView(BaseModel):
    scope: ConsentScope
    granted: bool
    granted_scopes: list[ConsentScope]


class ProfileSkillView(BaseModel):
    title: str
    origin: Literal["self_reported", "imported", "verified_course", "verified_project"]
    verified: bool


class ParticipantProfileView(BaseModel):
    person_id: UUID
    display_name: str
    city: str
    university: str
    study_year: str
    primary_track: str
    email: str
    telegram: str
    about: str
    avatar_url: str
    locale: Literal["ru-RU", "en-US"]
    theme: Literal["dark", "system"]
    timezone: str
    buddy_enabled: bool
    skills: list[ProfileSkillView]


class UpdateParticipantProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=160)
    city: str = Field(default="", max_length=160)
    university: str = Field(default="", max_length=255)
    study_year: str = Field(default="", max_length=64)
    primary_track: str = Field(default="", max_length=160)
    email: str = Field(default="", max_length=255)
    telegram: str = Field(default="", max_length=120)
    about: str = Field(default="", max_length=2000)
    avatar_url: str = Field(default="", max_length=2048)
    locale: Literal["ru-RU", "en-US"] = "ru-RU"
    theme: Literal["dark", "system"] = "dark"
    timezone: str = Field(default="Europe/Moscow", max_length=80)
    buddy_enabled: bool = True
    skills: list[str] = Field(default_factory=list, max_length=30)


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
        locale=actor.locale,
        timezone=actor.timezone,
        csrf_token=csrf_token,
    )


def _persona_view(persona: PersonaRecord) -> PersonaView:
    return PersonaView(
        key=persona.key,
        display_name=persona.display_name,
        roles=list(persona.roles),
    )


def _profile_view(profile: ParticipantProfile) -> ParticipantProfileView:
    return ParticipantProfileView(
        person_id=profile.person_id,
        display_name=profile.display_name,
        city=profile.city,
        university=profile.university,
        study_year=profile.study_year,
        primary_track=profile.primary_track,
        email=profile.email,
        telegram=profile.telegram,
        about=profile.about,
        avatar_url=profile.avatar_url,
        locale=profile.locale,  # type: ignore[arg-type]
        theme=profile.theme,  # type: ignore[arg-type]
        timezone=profile.timezone,
        buddy_enabled=profile.buddy_enabled,
        skills=[
            ProfileSkillView(
                title=skill.title,
                origin=skill.origin,  # type: ignore[arg-type]
                verified=skill.verified,
            )
            for skill in profile.skills
        ],
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


@router.get("/me/profile", response_model=ParticipantProfileView)
async def participant_profile(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> ParticipantProfileView:
    return _profile_view(await service.participant_profile(authenticated))


@router.put("/me/profile", response_model=ParticipantProfileView)
async def update_participant_profile(
    command: UpdateParticipantProfileRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> ParticipantProfileView:
    profile = ParticipantProfile(
        person_id=authenticated.actor.person_id,
        display_name=command.display_name,
        city=command.city,
        university=command.university,
        study_year=command.study_year,
        primary_track=command.primary_track,
        email=command.email,
        telegram=command.telegram,
        about=command.about,
        avatar_url=command.avatar_url,
        locale=command.locale,
        theme=command.theme,
        timezone=command.timezone,
        buddy_enabled=command.buddy_enabled,
        skills=tuple(ProfileSkill(title=item) for item in command.skills),
    )
    return _profile_view(await service.update_participant_profile(authenticated, profile))


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


class HrVisibilityView(BaseModel):
    visibility: dict[str, bool]


class HrVisibilityRequest(BaseModel):
    visible: bool


@router.get("/me/visibility", response_model=HrVisibilityView)
async def hr_visibility(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> HrVisibilityView:
    return HrVisibilityView(visibility=await service.hr_visibility(authenticated))


@router.put("/me/visibility/{scope}", response_model=HrVisibilityView)
async def set_hr_visibility(
    scope: str,
    command: HrVisibilityRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> HrVisibilityView:
    return HrVisibilityView(
        visibility=await service.set_hr_visibility(authenticated, scope, command.visible)
    )


@router.post("/auth/logout", status_code=204)
async def logout(
    response: Response,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DemoAuthService, Depends(_service)],
) -> None:
    await service.logout(authenticated)
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
