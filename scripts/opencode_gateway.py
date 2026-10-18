"""Small, fail-closed client for the local OpenCode Server API.

This is an experimental development tool. It does not expose an OpenAI-compatible
endpoint and it does not bypass provider authentication configured in OpenCode.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Any, cast

import httpx

DEFAULT_BASE_URL = "http://127.0.0.1:4096"
DEFAULT_MODEL = "opencode/glm-5.3-flash-free"
DEFAULT_USERNAME = "opencode"
DISABLED_TOOLS = ("bash", "edit", "write", "patch", "task")

type JsonValue = bool | int | float | str | list[JsonValue] | dict[str, JsonValue] | None
type JsonObject = dict[str, JsonValue]


class OpenCodeError(RuntimeError):
    """Raised when the OpenCode Server response cannot be used safely."""


@dataclass(frozen=True, slots=True)
class ModelRef:
    """OpenCode provider/model pair."""

    provider_id: str
    model_id: str

    @classmethod
    def parse(cls, value: str) -> ModelRef:
        provider_id, separator, model_id = value.strip().partition("/")
        if not separator or not provider_id or not model_id:
            raise ValueError("model must use the '<provider>/<model>' format")
        return cls(provider_id=provider_id, model_id=model_id)

    def as_request(self) -> dict[str, str]:
        return {"providerID": self.provider_id, "modelID": self.model_id}


class OpenCodeGateway:
    """Manage short-lived, non-mutating OpenCode sessions."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        username: str = DEFAULT_USERNAME,
        password: str | None = None,
        timeout_seconds: float = 120.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not password:
            raise ValueError("OPENCODE_SERVER_PASSWORD is required")
        self._client = httpx.Client(
            base_url=base_url.rstrip("/") + "/",
            auth=(username, password),
            timeout=timeout_seconds,
            transport=transport,
        )

    def __enter__(self) -> OpenCodeGateway:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def require_healthy(self) -> JsonObject:
        payload = self._request_json("GET", "global/health")
        if payload.get("healthy") is not True:
            raise OpenCodeError("OpenCode Server reported an unhealthy state")
        return payload

    def create_session(self, title: str) -> str:
        payload = self._request_json("POST", "session", json={"title": title})
        session_id = payload.get("id")
        if not isinstance(session_id, str) or not session_id:
            raise OpenCodeError("OpenCode did not return a session id")
        return session_id

    def delete_session(self, session_id: str) -> None:
        response = self._client.delete(f"session/{session_id}")
        self._raise_for_status(response)

    def send_message(
        self,
        session_id: str,
        prompt: str,
        *,
        model: ModelRef,
        agent: str = "plan",
    ) -> str:
        if not prompt.strip():
            raise ValueError("prompt must not be empty")

        payload = self._request_json(
            "POST",
            f"session/{session_id}/message",
            json={
                "model": model.as_request(),
                "agent": agent,
                "tools": {tool: False for tool in DISABLED_TOOLS},
                "parts": [{"type": "text", "text": prompt}],
            },
        )
        info = payload.get("info")
        if isinstance(info, dict) and info.get("error"):
            raise OpenCodeError(f"OpenCode model error: {info['error']!r}")

        parts = payload.get("parts")
        if not isinstance(parts, list):
            raise OpenCodeError("OpenCode response does not contain message parts")
        text_parts = [
            part.get("text", "")
            for part in parts
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        answer = "".join(part for part in text_parts if isinstance(part, str)).strip()
        if not answer:
            raise OpenCodeError("OpenCode response does not contain text")
        return answer

    def ask(
        self,
        prompt: str,
        *,
        model: ModelRef,
        agent: str = "plan",
        title: str = "gateway-request",
        check_health: bool = True,
    ) -> str:
        if check_health:
            self.require_healthy()
        session_id = self.create_session(title)
        try:
            return self.send_message(session_id, prompt, model=model, agent=agent)
        finally:
            self.delete_session(session_id)

    def _request_json(self, method: str, path: str, **kwargs: Any) -> JsonObject:
        response = self._client.request(method, path, **kwargs)
        self._raise_for_status(response)
        try:
            payload = cast(object, response.json())
        except ValueError as exc:
            raise OpenCodeError(f"OpenCode returned non-JSON data for {method} /{path}") from exc
        if not isinstance(payload, dict):
            raise OpenCodeError(f"OpenCode returned an unexpected payload for {method} /{path}")
        return cast(JsonObject, payload)

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            raise OpenCodeError(f"OpenCode request failed with HTTP {status}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Send one prompt through OpenCode Server")
    parser.add_argument("prompt", help="Prompt sent to a new short-lived OpenCode session")
    parser.add_argument(
        "--base-url",
        default=os.getenv("OPENCODE_SERVER_URL", DEFAULT_BASE_URL),
        help="OpenCode Server URL (default: %(default)s)",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("OPENCODE_MODEL", DEFAULT_MODEL),
        help="Model in provider/model form (default: %(default)s)",
    )
    parser.add_argument("--agent", default="plan", help="OpenCode agent name (default: plan)")
    parser.add_argument("--title", default="gateway-request", help="Temporary session title")
    parser.add_argument("--timeout", type=float, default=120.0, help="HTTP timeout in seconds")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        model = ModelRef.parse(args.model)
        with OpenCodeGateway(
            base_url=args.base_url,
            username=os.getenv("OPENCODE_SERVER_USERNAME", DEFAULT_USERNAME),
            password=os.getenv("OPENCODE_SERVER_PASSWORD"),
            timeout_seconds=args.timeout,
        ) as gateway:
            print(gateway.ask(args.prompt, model=model, agent=args.agent, title=args.title))
    except (OpenCodeError, ValueError, httpx.HTTPError) as exc:
        print(f"OpenCode gateway error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
