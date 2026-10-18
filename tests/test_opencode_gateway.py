from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.opencode_gateway import ModelRef, OpenCodeError, OpenCodeGateway


def test_model_ref_requires_provider_and_model() -> None:
    assert ModelRef.parse("opencode/glm-5.3-flash-free") == ModelRef(
        provider_id="opencode", model_id="glm-5.3-flash-free"
    )
    with pytest.raises(ValueError, match="provider"):
        ModelRef.parse("glm-5.3-flash-free")


def test_gateway_requires_server_password() -> None:
    with pytest.raises(ValueError, match="OPENCODE_SERVER_PASSWORD"):
        OpenCodeGateway()


def test_ask_uses_read_only_tools_and_deletes_session() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/global/health":
            return httpx.Response(200, json={"healthy": True})
        if request.method == "POST" and request.url.path == "/session":
            return httpx.Response(200, json={"id": "session-1"})
        if request.method == "POST" and request.url.path == "/session/session-1/message":
            body = json.loads(request.content)
            assert body["model"] == {
                "providerID": "opencode",
                "modelID": "glm-5.3-flash-free",
            }
            assert body["tools"] == {
                "bash": False,
                "edit": False,
                "write": False,
                "patch": False,
                "task": False,
            }
            return httpx.Response(
                200,
                json={"info": {}, "parts": [{"type": "text", "text": "OK"}]},
            )
        if request.method == "DELETE" and request.url.path == "/session/session-1":
            return httpx.Response(200, json=True)
        return httpx.Response(404)

    with OpenCodeGateway(
        password="test-password", transport=httpx.MockTransport(handler)
    ) as gateway:
        answer = gateway.ask("test", model=ModelRef.parse("opencode/glm-5.3-flash-free"))

    assert answer == "OK"
    assert requests[-1].method == "DELETE"


def test_ask_deletes_session_when_model_call_fails() -> None:
    deleted = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal deleted
        if request.url.path == "/global/health":
            return httpx.Response(200, json={"healthy": True})
        if request.method == "POST" and request.url.path == "/session":
            return httpx.Response(200, json={"id": "session-2"})
        if request.method == "DELETE":
            deleted = True
            return httpx.Response(200, json=True)
        return httpx.Response(503, json={"error": "unavailable"})

    with OpenCodeGateway(
        password="test-password", transport=httpx.MockTransport(handler)
    ) as gateway:
        with pytest.raises(OpenCodeError, match="HTTP 503"):
            gateway.ask("test", model=ModelRef.parse("opencode/glm-5.3-flash-free"))

    assert deleted is True
