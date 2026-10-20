"""Static provider catalog and deep-link allowlist for project platforms."""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlencode, urlparse

from impulse.api.errors import ApiError


@dataclass(frozen=True, slots=True)
class PlatformProvider:
    """One working platform exposed in the project «Платформы» section."""

    key: str
    title: str
    purpose: str
    connector_kind: str
    maybe_repository: bool
    repository_label: str
    required_permissions: tuple[str, ...]
    oauth_authorize_url: str
    deep_link_template: str
    allowed_link_hosts: frozenset[str]


GIGACODE = PlatformProvider(
    key="gigacode",
    title="GigaCode",
    purpose="ИИ-разработка кода проекта: ассистент, ревью и чат по репозиторию задания.",
    connector_kind="repository",
    maybe_repository=True,
    repository_label="Репозиторий участник/проект",
    required_permissions=(
        "repo:read",
        "repo:assistant",
        "repo:review",
    ),
    oauth_authorize_url="https://gigacode-ide.example/oauth/authorize",
    deep_link_template="https://gigacode-ide.example/workspace/{workspace}",
    allowed_link_hosts=frozenset({"gigacode-ide.example"}),
)

GIGACOWORK = PlatformProvider(
    key="gigacowork",
    title="GigaCoWork",
    purpose="Совместное рабочее пространство команды задания: задачи, артефакты, обсуждения.",
    connector_kind="workspace",
    maybe_repository=True,
    repository_label="Комната GigaCoWork",
    required_permissions=(
        "workspace:read",
        "workspace:write",
        "artifact:read",
    ),
    oauth_authorize_url="https://gigacowork-sber.example/oauth/authorize",
    deep_link_template="https://gigacowork-sber.example/c/{workspace}",
    allowed_link_hosts=frozenset({"gigacowork-sber.example"}),
)

GIGAAGENT = PlatformProvider(
    key="gigaagent",
    title="GigaAgent",
    purpose="Запуск обучающих agent-контуров проекта и сбор provisional artifacts.",
    connector_kind="agent_console",
    maybe_repository=False,
    repository_label="Консоль GigaAgent",
    required_permissions=(
        "agent-runs:read",
        "agent-runs:launch",
        "artifacts:read",
    ),
    oauth_authorize_url="https://gigaagent.example/oauth/authorize",
    deep_link_template="https://gigaagent.example/console/{workspace}",
    allowed_link_hosts=frozenset({"gigaagent.example"}),
)

GITVERSE = PlatformProvider(
    key="gitverse",
    title="GitVerse",
    purpose="Репозиторий проекта: история коммитов и артефакты для привязки к checkpoint.",
    connector_kind="repository",
    maybe_repository=True,
    repository_label="Репозиторий участник/проект",
    required_permissions=(
        "repo:read",
        "repo:commit:read",
    ),
    oauth_authorize_url="https://gitverse.ru/oauth/authorize",
    deep_link_template="https://gitverse.ru/{workspace}",
    allowed_link_hosts=frozenset({"gitverse.ru"}),
)

PROVIDERS: dict[str, PlatformProvider] = {
    provider.key: provider for provider in (GIGACODE, GIGACOWORK, GIGAAGENT, GITVERSE)
}
PROVIDER_KEYS: tuple[str, ...] = tuple(PROVIDERS)

WORKSPACE_REF_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._/-]{2,199}$"
BLOCKED_QUERY_KEYS = frozenset(
    {"token", "access_token", "refresh_token", "secret", "credential", "authorization"}
)


_WORKSPACE_REF_RE = re.compile(WORKSPACE_REF_PATTERN)


def get_provider(provider_key: str) -> PlatformProvider | None:
    return PROVIDERS.get(provider_key)


def validate_requested_scopes(
    provider: PlatformProvider, requested: tuple[str, ...] | None
) -> tuple[str, ...]:
    """Enforce least privilege: requested scopes are a subset of the provider permissions."""
    allowed = set(provider.required_permissions)
    selected = tuple(requested) if requested else tuple(provider.required_permissions)
    if not selected:
        raise ApiError(
            code="PLATFORM_SCOPE_REQUIRED",
            message="Выберите хотя бы одно разрешение платформы.",
            status_code=422,
        )
    unknown = [scope for scope in selected if scope not in allowed]
    if unknown:
        raise ApiError(
            code="PLATFORM_SCOPE_UNKNOWN",
            message="Запрошенные разрешения недоступны для этой платформы.",
            status_code=422,
        )
    return selected


def validate_workspace_ref(provider: PlatformProvider, workspace_ref: str | None) -> str | None:
    ref = (workspace_ref or "").strip()
    if provider.maybe_repository and not ref:
        raise ApiError(
            code="PLATFORM_WORKSPACE_REQUIRED",
            message="Укажите связанный " + provider.repository_label + ".",
            status_code=422,
        )
    if ref and _WORKSPACE_REF_RE.fullmatch(ref) is None:
        raise ApiError(
            code="PLATFORM_WORKSPACE_INVALID",
            message="Недопустимый идентификатор рабочей области.",
            status_code=422,
        )
    return ref or None


def validate_link_url(url: str) -> bool:
    """Allowlist validation for deep links: https, known host, no credentials in URL."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme != "https" or parsed.hostname is None:
        return False
    if parsed.username is not None or parsed.password is not None:
        return False
    if not parsed.path or parsed.path.startswith("/.."):
        return False
    for pair in parsed.query.split("&"):
        if not pair:
            continue
        key = pair.split("=", 1)[0].lower()
        if key in BLOCKED_QUERY_KEYS:
            return False
    return True


def build_deep_link(provider_key: str, workspace_ref: str | None) -> str | None:
    """Return the validated project deep link for a connected provider, or None."""
    provider = get_provider(provider_key)
    if provider is None or not workspace_ref:
        return None
    url = provider.deep_link_template.format(workspace=workspace_ref)
    parsed = urlparse(url)
    if parsed.hostname not in provider.allowed_link_hosts:
        return None
    if not validate_link_url(url):
        return None
    return url


def build_authorization_url(
    provider: PlatformProvider,
    *,
    state: str,
    scopes: tuple[str, ...],
) -> str:
    separator = "&" if "?" in provider.oauth_authorize_url else "?"
    query = urlencode(
        {
            "state": state,
            "scopes": " ".join(scopes),
        }
    )
    return f"{provider.oauth_authorize_url}{separator}{query}"
