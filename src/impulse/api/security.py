"""Browser security headers, origin checks, request limits, and rate buckets."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass
from time import monotonic
from typing import cast

from starlette.types import ASGIApp, Message, Receive, Scope, Send


@dataclass(frozen=True, slots=True)
class RateRule:
    limit: int
    window_seconds: float = 60


class RequestRateLimiter:
    def __init__(self, rules: dict[str, RateRule]) -> None:
        self.rules = rules
        self._buckets: dict[tuple[str, str], list[float]] = defaultdict(list)

    def allow(self, category: str, actor_key: str, now: float | None = None) -> bool:
        rule = self.rules[category]
        current = monotonic() if now is None else now
        key = (category, actor_key)
        cutoff = current - rule.window_seconds
        bucket = [value for value in self._buckets[key] if value > cutoff]
        if len(bucket) >= rule.limit:
            self._buckets[key] = bucket
            return False
        bucket.append(current)
        self._buckets[key] = bucket
        return True


class SecurityMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        allowed_origins: frozenset[str] = frozenset(),
        max_request_bytes: int = 1_048_576,
    ) -> None:
        self.app = app
        self.allowed_origins = allowed_origins
        self.max_request_bytes = max_request_bytes
        self.limiter = RequestRateLimiter(
            {
                "auth": RateRule(20),
                "search": RateRule(60),
                "write": RateRule(120),
                "agents": RateRule(30),
            }
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        method = str(scope.get("method", "GET")).upper()
        path = str(scope.get("path", "/"))
        origin = headers.get(b"origin", b"").decode("ascii", errors="ignore")
        if method not in {"GET", "HEAD", "OPTIONS"} and origin:
            if origin not in self.allowed_origins:
                await self._reject(send, 403, "UNSAFE_ORIGIN")
                return
        raw_length = headers.get(b"content-length", b"0")
        try:
            content_length = int(raw_length)
        except ValueError:
            await self._reject(send, 400, "INVALID_REQUEST")
            return
        if content_length > self.max_request_bytes:
            await self._reject(send, 413, "PAYLOAD_TOO_LARGE")
            return
        category = self._category(path, method)
        cookie = headers.get(b"cookie", b"")
        client = cast(object, scope.get("client"))
        remote = (
            client[0]
            if isinstance(client, tuple) and client and isinstance(client[0], str)
            else "unknown"
        )
        actor_key = hashlib.sha256(cookie or remote.encode()).hexdigest()[:16]
        if not self.limiter.allow(category, actor_key):
            await self._reject(send, 429, "RATE_LIMITED", retry_after="60")
            return

        async def secure_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                response_headers = list(message.get("headers", []))
                response_headers.extend(
                    [
                        (b"content-security-policy", b"default-src 'self'; frame-ancestors 'none'"),
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"DENY"),
                        (b"referrer-policy", b"strict-origin-when-cross-origin"),
                    ]
                )
                message["headers"] = response_headers
            await send(message)

        await self.app(scope, receive, secure_send)

    @staticmethod
    def _category(path: str, method: str) -> str:
        if "/auth/" in path:
            return "auth"
        if "/search" in path:
            return "search"
        if "/agents/" in path:
            return "agents"
        return "write" if method not in {"GET", "HEAD", "OPTIONS"} else "search"

    @staticmethod
    async def _reject(
        send: Send, status_code: int, code: str, *, retry_after: str | None = None
    ) -> None:
        body = json.dumps({"code": code, "message": "Request rejected.", "request_id": "safe"})
        encoded = body.encode()
        headers = [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(encoded)).encode()),
        ]
        if retry_after is not None:
            headers.append((b"retry-after", retry_after.encode()))
        await send({"type": "http.response.start", "status": status_code, "headers": headers})
        await send({"type": "http.response.body", "body": encoded})
