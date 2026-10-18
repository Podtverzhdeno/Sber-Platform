"""Immutable prompt versions identified by a content hash."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256


@dataclass(frozen=True, slots=True)
class PromptVersion:
    name: str
    version: str
    content: str
    content_hash: str


class PromptRegistry:
    def __init__(self) -> None:
        self._prompts: dict[tuple[str, str], PromptVersion] = {}

    def register(self, name: str, version: str, content: str) -> PromptVersion:
        if not name or not version or not content.strip():
            raise ValueError("prompt name, version, and content are required")
        key = (name, version)
        prompt = PromptVersion(name, version, content, sha256(content.encode()).hexdigest())
        existing = self._prompts.get(key)
        if existing is not None and existing != prompt:
            raise ValueError("an existing prompt version is immutable")
        self._prompts[key] = prompt
        return prompt

    def get(self, name: str, version: str) -> PromptVersion:
        try:
            return self._prompts[(name, version)]
        except KeyError as error:
            raise LookupError(f"unknown prompt version: {name}/{version}") from error
