from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.agentic_coding import (
    ROLE_TARGETS,
    SOURCE_MAP_VERSION,
    QualifiedEvidence,
    VerificationStatus,
    evaluate_profile,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings

PERSON = UUID("00000000-0000-0000-0000-000000000001")
NOW = datetime(2026, 10, 24, 9, 0, tzinfo=UTC)


def evidence(
    *,
    skill: str = "prompting",
    level: int = 3,
    status: VerificationStatus = VerificationStatus.VERIFIED,
    trusted: bool = True,
    person_id: UUID = PERSON,
    role: str = "developer",
    framework_version: str = SOURCE_MAP_VERSION,
    revoked_at: datetime | None = None,
) -> QualifiedEvidence:
    return QualifiedEvidence(
        person_id=person_id,
        role_key=role,
        skill_key=skill,
        level=level,
        framework_version=framework_version,
        status=status,
        source_ref="signed-event:qualified-123",
        observed_at=NOW,
        trusted=trusted,
        revoked_at=revoked_at,
    )


def test_pdf_targets_and_missing_analyst_axis_not_level_zero() -> None:
    assert ROLE_TARGETS == {
        "developer": (3, 4, 3, 2, 3, 2),
        "analyst": (3, None, 3, 2, 2, 2),
        "qa": (3, 2, 2, 2, 2, 2),
    }
    profile = evaluate_profile(PERSON, "analyst", as_of=NOW)
    assert profile.skills[1].target_level is None
    assert profile.skills[1].current_level is None
    assert profile.known_evidence_count == 0
    assert profile.certification_state == "not_evaluable"
    assert profile.profile_scope == "impulse_learning"


def test_only_trusted_person_role_version_and_verified_records_count() -> None:
    rows = (
        evidence(level=2),
        evidence(skill="prompt_engineering", status=VerificationStatus.REPORTED),
        evidence(skill="context_management", trusted=False),
        evidence(skill="tools_mcp", role="qa"),
        evidence(skill="agents_team", person_id=UUID(int=12)),
        evidence(skill="creating_skills", framework_version="wrong-version"),
        evidence(skill="prompting", level=4, revoked_at=NOW),
    )
    result = evaluate_profile(PERSON, "developer", rows, as_of=NOW)
    assert result.skills[0].current_level == 2
    assert result.skills[0].evidence_count == 1
    assert all(skill.current_level is None for skill in result.skills[1:])
    assert result.certification_state == "not_evaluable"
    assert result.data_origin == "verified_evidence"


def test_rejects_invalid_agentic_ordinal_and_no_cross_role_reuse() -> None:
    for invalid in (0, 5):
        try:
            evidence(level=invalid)
        except ValueError as exc:
            assert "ordinal" in str(exc)
        else:
            raise AssertionError("invalid level silently accepted")
    assert evaluate_profile(PERSON, "qa", (evidence(),), as_of=NOW).known_evidence_count == 0


def client() -> TestClient:
    return TestClient(
        create_app(Settings(
            app_env=AppEnvironment.TEST,
            demo_mode=True,
            session_secret=SecretStr("test-session-secret-with-at-least-32-characters"),
        ))
    )


def test_api_requires_auth_and_never_issues_student_l1() -> None:
    with client() as c:
        assert c.get("/api/v1/me/agentic-coding/profile").status_code == 401
        assert (\n            c.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}).status_code\n            == 200\n        )
        response = c.get("/api/v1/me/agentic-coding/profile?role_key=developer")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert [skill["target_level"] for skill in payload["skills"]] == [3, 4, 3, 2, 3, 2]
        assert all(skill["current_level"] is None for skill in payload["skills"])
        assert payload["certification_state"] == "not_evaluable"
        assert payload["profile_scope"] == "impulse_learning"
        assert payload["data_origin"] == "not_connected"
        assert c.get("/api/v1/me/agentic-coding/profile?role_key=bogus").status_code == 422


def test_api_denies_other_roles() -> None:
    with client() as c:
        c.post("/api/v1/auth/demo-login", json={"persona_key": "mentor-elena"})
        response = c.get("/api/v1/me/agentic-coding/profile")
        assert response.status_code == 404
        assert response.json()["code"] == "NOT_FOUND"
