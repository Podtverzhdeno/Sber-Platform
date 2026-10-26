"""Compatibility facade for curriculum stage guides; source is in application."""

from impulse.application.ai_stage_guides import GUIDES as GUIDES
from impulse.application.ai_stage_guides import RoleGuides as RoleGuides
from impulse.application.ai_stage_guides import StageGuide as StageGuide
from impulse.application.ai_stage_guides import stage_guide as stage_guide

_GUIDES = GUIDES
