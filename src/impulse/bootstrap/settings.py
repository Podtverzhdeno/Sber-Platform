"""Validated runtime configuration with secret-safe projections."""

from __future__ import annotations

import hashlib
from enum import StrEnum
from typing import Self

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppEnvironment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Fail-fast configuration for product and optional integrations."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: AppEnvironment = AppEnvironment.DEVELOPMENT
    demo_mode: bool = True
    app_host: str = "127.0.0.1"
    app_port: int = Field(default=8000, ge=1, le=65535)
    allowed_origin: AnyHttpUrl | None = None
    max_request_bytes: int = Field(default=1_048_576, ge=1_024, le=10_485_760)
    database_url: SecretStr | None = None
    session_secret: SecretStr | None = None
    platform_vault_secret: SecretStr | None = None
    session_ttl_seconds: int = Field(default=43_200, ge=300, le=604_800)
    auth_provider_url: AnyHttpUrl | None = None

    platforms_http_enabled: bool = False
    platforms_http_dry_run: bool = False
    platforms_http_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    platforms_token_urls: dict[str, AnyHttpUrl] = Field(default_factory=dict)
    platforms_item_urls: dict[str, AnyHttpUrl] = Field(default_factory=dict)
    openrouter_api_key: SecretStr | None = None
    ai_buddy_enabled: bool = False
    ai_mentor_draft_enabled: bool = False
    ai_operator_triage_enabled: bool = False
    ai_customer_brief_enabled: bool = False
    openrouter_model_buddy: str = "openrouter/free"
    openrouter_model_structured: str = "openrouter/free"
    ai_max_requests_per_user_day: int = Field(default=5, ge=1, le=100)
    ai_max_requests_per_run: int = Field(default=3, ge=1, le=20)
    ai_max_tool_calls_per_run: int = Field(default=4, ge=1, le=20)
    ai_max_steps_per_run: int = Field(default=8, ge=1, le=50)
    ai_timeout_seconds: float = Field(default=30, ge=1, le=120)
    honor_board_enabled: bool = False

    langfuse_enabled: bool = False
    langfuse_public_key: SecretStr | None = None
    langfuse_secret_key: SecretStr | None = None
    langfuse_base_url: AnyHttpUrl | None = None
    langfuse_content_capture_enabled: bool = False

    @field_validator("database_url", "session_secret", "platform_vault_secret", mode="before")
    @classmethod
    def blank_secret_is_unset(cls, value: object) -> object:
        """Treat a blank value as absent and fall back to defaults."""
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def any_ai_enabled(self) -> bool:
        return any(
            (
                self.ai_buddy_enabled,
                self.ai_mentor_draft_enabled,
                self.ai_operator_triage_enabled,
                self.ai_customer_brief_enabled,
            )
        )

    @staticmethod
    def _is_free_model(model: str) -> bool:
        return model == "openrouter/free" or model.endswith(":free")

    @model_validator(mode="after")
    def validate_runtime_contract(self) -> Self:
        if not self.demo_mode and self.auth_provider_url is None:
            raise ValueError("AUTH_PROVIDER_URL is required when DEMO_MODE=false")
        if self.app_env is AppEnvironment.PRODUCTION:
            if self.session_secret is None or len(self.session_secret.get_secret_value()) < 32:
                raise ValueError("SESSION_SECRET with at least 32 characters is required")
            if self.database_url is None:
                raise ValueError("DATABASE_URL is required in production")
        if self.any_ai_enabled and self.openrouter_api_key is None:
            raise ValueError("OPENROUTER_API_KEY is required when an AI feature is enabled")
        for model in (self.openrouter_model_buddy, self.openrouter_model_structured):
            if not self._is_free_model(model):
                raise ValueError("Only openrouter/free or an explicit :free model is allowed")
        if self.langfuse_enabled and not all(
            (self.langfuse_public_key, self.langfuse_secret_key, self.langfuse_base_url)
        ):
            raise ValueError("Langfuse keys and base URL are required when enabled")
        if self.langfuse_content_capture_enabled and not self.langfuse_enabled:
            raise ValueError("Langfuse content capture requires Langfuse to be enabled")
        return self

    def public_flags(self) -> dict[str, bool | str]:
        """Return the only configuration safe to expose to a browser."""
        return {
            "app_env": self.app_env.value,
            "demo_mode": self.demo_mode,
            "ai_buddy_enabled": self.ai_buddy_enabled,
            "ai_mentor_draft_enabled": self.ai_mentor_draft_enabled,
            "ai_operator_triage_enabled": self.ai_operator_triage_enabled,
            "ai_customer_brief_enabled": self.ai_customer_brief_enabled,
            "honor_board_enabled": self.honor_board_enabled,
        }

    def session_signing_secret(self) -> str:
        """Use an explicit secret, with a conspicuous dev-only fallback for zero-config demos."""
        if self.session_secret is not None:
            return self.session_secret.get_secret_value()
        if self.app_env in {AppEnvironment.DEVELOPMENT, AppEnvironment.TEST}:
            return "impulse-local-development-session-secret-change-me"
        raise ValueError("SESSION_SECRET is required for authentication")

    def platform_sealing_secret(self) -> str:
        """Return deployment-owned key material for the credential vault.

        A dedicated secret is preferred. The signed-session secret is a safe
        compatibility root because the vault derives domain-separated keys.
        """
        if self.platform_vault_secret is not None:
            value = self.platform_vault_secret.get_secret_value()
            if len(value) < 32:
                raise ValueError("PLATFORM_VAULT_SECRET must contain at least 32 characters")
            return value
        session_root = self.session_signing_secret()
        return hashlib.sha256(
            ("impulse/platform-secret-root/v1\x00" + session_root).encode("utf-8")
        ).hexdigest()
