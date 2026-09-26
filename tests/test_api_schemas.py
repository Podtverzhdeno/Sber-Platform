"""API serialization contract tests."""

from datetime import datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from impulse.api.v1.schemas import CursorPage, Money, TimestampedModel
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import Settings


def test_money_round_trip_is_decimal_string() -> None:
    value = Money.model_validate({"amount": Decimal("15000.50"), "currency": "RUB"})

    assert value.model_dump_json() == '{"amount":"15000.50","currency":"RUB"}'
    assert Money.model_validate_json(value.model_dump_json()).amount == Decimal("15000.50")


def test_money_rejects_binary_float() -> None:
    with pytest.raises(ValidationError):
        Money.model_validate({"amount": 0.1, "currency": "RUB"})


def test_timestamp_requires_timezone_and_serializes_utc() -> None:
    with pytest.raises(ValidationError):
        TimestampedModel(occurred_at=datetime(2026, 1, 1))

    value = TimestampedModel.model_validate_json('{"occurred_at":"2026-01-01T03:00:00+03:00"}')
    assert value.model_dump_json() == '{"occurred_at":"2026-01-01T00:00:00Z"}'


def test_cursor_page_requires_consistent_cursor() -> None:
    with pytest.raises(ValidationError):
        CursorPage[str](items=["one"], has_more=True)


def test_public_config_excludes_secrets() -> None:
    settings = Settings.model_validate(
        {
            "openrouter_api_key": "synthetic-not-a-real-key",
            "session_secret": "synthetic-session-secret",
        }
    )
    response = TestClient(create_app(settings)).get("/api/v1/config")

    assert response.status_code == 200
    assert "secret" not in response.text.lower()
    assert "key" not in response.text.lower()
    assert "synthetic" not in response.text.lower()
