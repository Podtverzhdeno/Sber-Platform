"""Curriculum content relocation must not change stage teaching material."""

from __future__ import annotations

from impulse.application.ai_curriculum_details import (
    AI_CURRICULUM_DETAILS as CANONICAL_COURSES,
)
from impulse.application.ai_curriculum_details import (
    learning_details as canonical_learning_details,
)
from impulse.application.ai_reading_resources import (
    reading_for_stage as canonical_reading_for_stage,
)
from impulse.application.ai_stage_guides import stage_guide as canonical_stage_guide
from impulse.bootstrap.ai_curriculum_details import (
    AI_CURRICULUM_DETAILS as COMPAT_COURSES,
)
from impulse.bootstrap.ai_curriculum_details import learning_details as compat_learning_details
from impulse.bootstrap.ai_reading_resources import reading_for_stage as compat_reading_for_stage
from impulse.bootstrap.ai_stage_guides import stage_guide as compat_stage_guide


def test_legacy_curriculum_facades_share_the_exact_authoritative_data() -> None:
    assert CANONICAL_COURSES is COMPAT_COURSES
    assert compat_learning_details is canonical_learning_details
    assert compat_reading_for_stage is canonical_reading_for_stage
    assert compat_stage_guide is canonical_stage_guide


def test_every_track_stage_preserves_curriculum_data_and_schema() -> None:
    assert CANONICAL_COURSES
    for track_key, modules in CANONICAL_COURSES.items():
        assert modules
        for stage_position, module in enumerate(modules, 1):
            expected = compat_learning_details(track_key, stage_position)
            actual = canonical_learning_details(track_key, stage_position)
            assert actual == expected
            assert actual["theory"] == module["theory"]
            assert actual["acceptance"] == module["acceptance"]
            assert actual["estimated_hours"] == module["estimated_hours"]
            assert actual["resources"] == canonical_reading_for_stage(track_key, stage_position)
            assert isinstance(actual["lab"], str) and actual["lab"]
