"""Bounded Buddy workflow with deterministic safety routing and grounded output."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import cast

from pydantic import ValidationError

from impulse.ai.buddy.tools import ToolEvidence
from impulse.ai.gateway import (
    JsonObject,
    JsonValue,
    ModelGateway,
    ModelGatewayError,
    ModelMessage,
    ModelPurpose,
)
from impulse.ai.prompts import AgentAnswer


class BuddyRoute(StrEnum):
    ANSWER = "answer"
    REFUSE = "refuse"
    MANUAL = "manual"


@dataclass(frozen=True, slots=True)
class BuddyReply:
    route: BuddyRoute
    text: str
    source_refs: tuple[str, ...] = ()


class BuddyGraph:
    """classify → read tools → grounded model answer → strict validation."""

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway

    async def run(
        self,
        question: str,
        evidence: Sequence[ToolEvidence],
        *,
        correlation_id: str,
    ) -> BuddyReply:
        route = self.classify(question)
        if route is BuddyRoute.REFUSE:
            return BuddyReply(route, "Я не могу менять роль или права доступа.")
        if route is BuddyRoute.MANUAL:
            return BuddyReply(route, "Нужна проверка человеком; продолжите по ручному маршруту.")
        allowed_refs = [item.source_ref for item in evidence]
        if not allowed_refs:
            return BuddyReply(BuddyRoute.MANUAL, "Нет проверяемого источника для ответа.")
        source_text = "\n".join(
            f"[{item.source_ref}@{item.source_version}] {'; '.join(item.facts)}"
            for item in evidence
        )
        result = await self.gateway.invoke(
            ModelPurpose.BUDDY,
            (
                ModelMessage("system", "Answer only from SOURCES and cite source_refs."),
                ModelMessage("user", f"QUESTION: {question}\nSOURCES:\n{source_text}"),
            ),
            response_schema=AgentAnswer,
            correlation_id=correlation_id,
        )
        if result.structured is None:
            raise ModelGatewayError.from_malformed()
        payload: JsonObject = dict(result.structured)
        payload["allowed_source_refs"] = cast(JsonValue, allowed_refs)
        try:
            answer = AgentAnswer.model_validate(payload)
        except ValidationError as error:
            raise ModelGatewayError.from_malformed() from error
        return BuddyReply(BuddyRoute.ANSWER, answer.answer, tuple(answer.source_refs))

    @staticmethod
    def classify(question: str) -> BuddyRoute:
        normalized = question.casefold()
        if any(token in normalized for token in ("смени роль", "дай права", "become admin")):
            return BuddyRoute.REFUSE
        if any(
            token in normalized
            for token in ("деньги", "выплата", "оффер", "зарплата", "гарантируй", "событи")
        ):
            return BuddyRoute.MANUAL
        return BuddyRoute.ANSWER
