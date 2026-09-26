"""Validated runtime configuration with secret-safe projections."""

from __future__ import annotations

from enum import StrEnum
from typing import Self

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
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
    database_url: SecretStr | None = None
    session_secret: SecretStr | None = None
    auth_provider_url: AnyHttpUrl | None = None

    openrouter_api_key: SecretStr | None = None
    ai_buddy_enabled: bool = False
    ai_mentor_draft_enabled: bool = False
    ai_operator_triage_enabled: bool = False
    ai_customer_brief_enabled: bool = False
    openrouter_model_buddy: str = "openrouter/free"
    openrouter_model_structured: str = "openrouter/free"
    ai_max_requests_per_user_day: int = Field(default=5, ge=1, le=100)
    ai_max_tool_calls_per_run: int = Field(default=4, ge=1, le=20)

    langfuse_enabled: bool = False
    langfuse_public_key: SecretStr | None = None
    langfuse_secret_key: SecretStr | None = None
    langfuse_base_url: AnyHttpUrl | None = None
    langfuse_content_capture_enabled: bool = False

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
        }
