"""Data minimization and secret scanning before external inference."""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from impulse.ai.gateway import ModelErrorCode, ModelGatewayError, ModelPurpose


class DataClass(StrEnum):
    PUBLIC = "public"
    DEMO_SYNTHETIC = "demo_synthetic"
    PERSONAL_MINIMAL = "personal_minimal"
    INTERNAL_BUSINESS = "internal_business"
    SENSITIVE_PERSONAL = "sensitive_personal"
    SECRET = "secret"  # noqa: S105 - classification label, never a credential value


@dataclass(frozen=True, slots=True)
class ClassifiedField:
    name: str
    value: str
    data_class: DataClass


@dataclass(frozen=True, slots=True)
class PreflightResult:
    fields: Mapping[str, str]
    redacted_fields: tuple[str, ...]


_ALLOWED_FIELDS: dict[ModelPurpose, frozenset[str]] = {
    ModelPurpose.BUDDY: frozenset({"question", "roadmap", "public_sources"}),
    ModelPurpose.MENTOR_REVIEW: frozenset({"artifact_excerpt", "rubric", "public_sources"}),
    ModelPurpose.OPERATOR_TRIAGE: frozenset({"case_summary", "external_ids", "public_sources"}),
    ModelPurpose.CUSTOMER_BRIEF: frozenset({"brief", "constraints", "public_sources"}),
}
_BLOCKED_CLASSES = frozenset(
    {DataClass.INTERNAL_BUSINESS, DataClass.SENSITIVE_PERSONAL, DataClass.SECRET}
)
_SECRET_PATTERNS = (
    re.compile(r"\bsk-or-v1-[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"(?i)\b(?:authorization:\s*bearer|password|api[_-]?key|secret)\s*[:=]\s*\S+"),
)


class PrivacyPreflight:
    """Validate explicit classifications and return only approved fields."""

    def inspect(
        self,
        purpose: ModelPurpose,
        fields: tuple[ClassifiedField, ...],
        *,
        personal_consent: bool = False,
    ) -> PreflightResult:
        allowed = _ALLOWED_FIELDS[purpose]
        clean: dict[str, str] = {}
        redacted: list[str] = []
        for field in fields:
            if field.name not in allowed or field.data_class in _BLOCKED_CLASSES:
                self._blocked()
            if field.data_class is DataClass.PERSONAL_MINIMAL and not personal_consent:
                self._blocked()
            value = field.value.strip()
            if any(pattern.search(value) for pattern in _SECRET_PATTERNS):
                redacted.append(field.name)
                value = "[REDACTED]"
            if value:
                clean[field.name] = value[:12_000]
        if not clean:
            self._blocked()
        return PreflightResult(fields=clean, redacted_fields=tuple(redacted))

    @staticmethod
    def _blocked() -> None:
        raise ModelGatewayError(ModelErrorCode.PRIVACY_POLICY_BLOCKED, retryable=False)
