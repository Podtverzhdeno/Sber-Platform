"""Runtime settings contract tests."""

import pytest
from pydantic import ValidationError
from pydantic_settings import SettingsConfigDict

from impulse.bootstrap.settings import AppEnvironment, Settings


class IsolatedSettings(Settings):
    """Settings that never read the developer's local .env during tests."""

    model_config = SettingsConfigDict(env_file=None, extra="ignore")


def test_development_demo_has_safe_defaults() -> None:
    settings = IsolatedSettings()

    assert settings.demo_mode is True
    assert settings.openrouter_model_buddy == "openrouter/free"
    assert settings.honor_board_enabled is False


def test_non_demo_fails_without_real_auth_provider() -> None:
    with pytest.raises(ValidationError, match="AUTH_PROVIDER_URL"):
        IsolatedSettings(demo_mode=False)


def test_ai_fails_without_openrouter_secret() -> None:
    with pytest.raises(ValidationError, match="OPENROUTER_API_KEY"):
        IsolatedSettings(ai_buddy_enabled=True)


def test_production_fails_without_required_secrets() -> None:
    with pytest.raises(ValidationError, match="SESSION_SECRET"):
        IsolatedSettings.model_validate(
            {
                "app_env": AppEnvironment.PRODUCTION,
                "demo_mode": False,
                "auth_provider_url": "https://auth.example.test",
            }
        )


def test_paid_model_is_rejected_even_with_key() -> None:
    with pytest.raises(ValidationError, match="Only openrouter/free"):
        IsolatedSettings.model_validate(
            {
                "ai_buddy_enabled": True,
                "openrouter_api_key": "synthetic-not-a-real-key",
                "openrouter_model_buddy": "vendor/paid-model",
            }
        )


def test_public_flags_do_not_serialize_secrets_or_models() -> None:
    settings = IsolatedSettings.model_validate(
        {
            "openrouter_api_key": "synthetic-not-a-real-key",
            "database_url": "postgresql://private.example.test/database",
            "session_secret": "synthetic-session-secret",
        }
    )

    serialized = repr(settings.public_flags())
    assert "synthetic" not in serialized
    assert "postgresql" not in serialized
    assert "openrouter_model" not in serialized
