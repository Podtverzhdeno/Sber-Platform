"""Application-level error contract, independent of the HTTP adapter.

Compatibility phase: existing use cases still pass legacy HTTP status hints.
Move status selection to the API mapper in a follow-up, bounded-context refactor.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class ApiError(Exception):
    """Legacy named application error, kept ABI-compatible for API consumers."""

    code: str
    message: str
    status_code: int
    retryable: bool = False
    field_errors: dict[str, list[str]] | None = field(default=None)

    def __post_init__(self) -> None:
        # A slotted dataclass can replace its class object; avoid no-arg super().
        Exception.__init__(self, self.message)
