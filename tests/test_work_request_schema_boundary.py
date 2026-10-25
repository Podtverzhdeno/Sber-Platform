"""Compatibility and validation tests for the extracted work request schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from impulse.api.v1 import work, work_requests

EXPORTED_REQUESTS = (
    "AcceptApplicationRequest",
    "AcceptTermsRequest",
    "ArtifactRequest",
    "AuthorshipDisputeRequest",
    "CaseRubricRequest",
    "CatalogStageRequest",
    "CheckpointRequest",
    "CompensationRequest",
    "ContributionDecisionRequest",
    "ContributionRequest",
    "CreateTaskRequest",
    "DecideInvitationRequest",
    "InviteCandidateRequest",
    "RepeatTaskRequest",
    "ReviseTermsRequest",
    "SupportRequest",
    "TaskCatalogMetadataRequest",
    "TeamRequestCommand",
)


def test_all_previous_request_imports_have_identical_class_identity() -> None:
    for name in EXPORTED_REQUESTS:
        original = getattr(work, name)
        extracted = getattr(work_requests, name)
        assert original is extracted, name


def test_catalog_normalization_and_nested_stage_contract() -> None:
    payload = work_requests.TaskCatalogMetadataRequest.model_validate(
        {
            "direction_keys": [" Python ", "python", " ML "],
            "prerequisite_tags": ["Git", " GIT "],
            "selection_criteria": [" Ability to code ", " Reliable delivery "],
            "stage_plan": [
                {
                    "key": "implementation",
                    "title": "Реализация",
                    "summary": "Результат команды",
                    "estimated_minutes": 60,
                }
            ],
        }
    )
    value = payload.to_domain()
    assert value.direction_keys == ("python", "ml")
    assert value.prerequisite_tags == ("git",)
    assert value.selection_criteria == ("Ability to code", "Reliable delivery")
    assert value.stage_plan[0].key == "implementation"
    assert value.stage_plan[0].estimated_minutes == 60


def test_existing_validation_bounds_are_preserved() -> None:
    with pytest.raises(ValidationError):
        work_requests.CatalogStageRequest(key="a", title="b", summary="c", estimated_minutes=0)
    with pytest.raises(ValidationError):
        work_requests.CompensationRequest(
            paid=True,
            currency="rub",
            a_multiplier="1",
            policy_version=1,
            payout_condition="Результат",
        )


def test_customer_routes_and_body_models_remain_registered() -> None:
    routes = {
        (path, method)
        for route in work.router.routes
        for path in (getattr(route, "path", None),)
        for method in (getattr(route, "methods", None) or set())
    }
    assert ("/customer/projects/{project_key}/tasks", "POST") in routes
    assert ("/customer/team-requests", "POST") in routes
    assert ("/me/assignments/{assignment_id}/contributions", "POST") in routes
