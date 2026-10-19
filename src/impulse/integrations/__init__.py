"""Project platform connection catalog (openspec 22.20).

Server-side connection model for GigaCode, GigaCoWork, GigaAgent and GitVerse:
project-scoped scopes, sealed credentials, connect/reconnect/revoke lifecycle,
content-free audit and allowlist-validated deep links. Wiring into the FastAPI
app registry and OpenAPI snapshot ownership remains a separate integration lane.
"""

from __future__ import annotations

from impulse.integrations.api import router as platform_router
from impulse.integrations.providers import (
    PROVIDER_KEYS,
    PlatformProvider,
    build_authorization_url,
    build_deep_link,
    get_provider,
    validate_link_url,
    validate_requested_scopes,
    validate_workspace_ref,
)
from impulse.integrations.service import PlatformConnectionService

__all__ = [
    "PROVIDER_KEYS",
    "PlatformConnectionService",
    "PlatformProvider",
    "build_authorization_url",
    "build_deep_link",
    "get_provider",
    "platform_router",
    "validate_link_url",
    "validate_requested_scopes",
    "validate_workspace_ref",
]
