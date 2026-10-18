"""Strict schemas that keep malformed or ungrounded output out of the domain/UI."""

from __future__ import annotations

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AgentAnswer(StrictOutput):
    answer: str = Field(min_length=1, max_length=8_000)
    source_refs: list[str] = Field(min_length=1, max_length=20)
    allowed_source_refs: list[str] = Field(exclude=True, min_length=1)
    uncertainty: str | None = Field(default=None, max_length=1_000)

    @model_validator(mode="after")
    def sources_are_authorized(self) -> Self:
        if not set(self.source_refs).issubset(self.allowed_source_refs):
            raise ValueError("answer contains an unauthorized source reference")
        return self


class ReviewSuggestion(StrictOutput):
    summary: str = Field(min_length=1, max_length=4_000)
    criterion_refs: list[str] = Field(min_length=1, max_length=30)
    recommendation: Literal["accept", "revise", "manual_review"]
    artifact_version: str = Field(min_length=1, max_length=100)
    rubric_version: str = Field(min_length=1, max_length=100)


class OperatorSuggestion(StrictOutput):
    summary: str = Field(min_length=1, max_length=4_000)
    priority: Literal["low", "medium", "high", "critical"]
    reason: str = Field(min_length=1, max_length=2_000)
    external_ids: list[str] = Field(default_factory=list, max_length=20)


class CustomerBriefSuggestion(StrictOutput):
    problem: str = Field(min_length=1, max_length=2_000)
    deliverable: str = Field(min_length=1, max_length=2_000)
    acceptance_criteria: list[str] = Field(min_length=1, max_length=20)
    disclaimer: Literal["draft_requires_human_publish"]
