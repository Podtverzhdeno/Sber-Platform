"""Bootcamp catalog: explainable relevance, access, completion and recommendation states."""

from __future__ import annotations

from impulse.bootcamp.api import CourseCardView as CourseCardView
from impulse.bootcamp.api import MustTakeView as MustTakeView
from impulse.bootcamp.api import router as catalog_router
from impulse.bootcamp.catalog import (
    ACCESS_AVAILABLE,
    ACCESS_PREREQUISITE,
    ACCESS_UNAVAILABLE,
    COMPLETION_NOT_STARTED,
    COMPLETION_PENDING,
    COMPLETION_VERIFIED,
    TARGET_LEVEL_LABEL,
    CourseCard,
    MustTakeReason,
    SkillPosition,
    determine_access_state,
    prerequisite_keys,
    project_cards,
)
from impulse.bootcamp.service import BootcampCatalogService

__all__ = [
    "ACCESS_AVAILABLE",
    "ACCESS_PREREQUISITE",
    "ACCESS_UNAVAILABLE",
    "COMPLETION_NOT_STARTED",
    "COMPLETION_PENDING",
    "COMPLETION_VERIFIED",
    "TARGET_LEVEL_LABEL",
    "BootcampCatalogService",
    "CourseCard",
    "CourseCardView",
    "MustTakeReason",
    "MustTakeView",
    "SkillPosition",
    "catalog_router",
    "determine_access_state",
    "prerequisite_keys",
    "project_cards",
]
