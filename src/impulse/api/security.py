"""Browser security headers, origin checks, request limits, and rate buckets."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from time import monotonic
from typing import TYPE_CHECKING, cast
from urllib.parse import urlparse

from starlette.types import ASGIApp, Message, Receive, Scope, Send

if TYPE_CHECKING:
    from impulse.infrastructure.rate_limit_store import RateWindowStore


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
        shared_rate_store: RateWindowStore | None = None,
    ) -> None:
        self.app = app
        self.allowed_origins = allowed_origins
        self.max_request_bytes = max_request_bytes
        self.shared_rate_store = shared_rate_store
        self.limiter = RequestRateLimiter(
            {
                "auth": RateRule(20),
                "search": RateRule(60),
                # Ordinary authenticated read models share a separate budget.
                # A complex page may fetch 30+ authorized projections at once.
                "read": RateRule(240),
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
            same_origin = self._same_origin(origin, headers)
            if origin not in self.allowed_origins and not same_origin:
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
        if not await self._within_rate_limit(category, actor_key):
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

    async def _within_rate_limit(self, category: str, actor_key: str) -> bool:
        rule = self.limiter.rules[category]
        if self.shared_rate_store is not None:
            decision = await self.shared_rate_store.slide_window(
                category,
                actor_key,
                window_seconds=rule.window_seconds,
                limit=rule.limit,
                now=datetime.now(UTC),
            )
            return decision.allowed
        return self.limiter.allow(category, actor_key)

    @staticmethod
    def _same_origin(origin: str, headers: dict[bytes, bytes]) -> bool:
        try:
            origin_url = urlparse(origin)
            host_header = headers.get(b"host", b"").decode("ascii", errors="ignore")
            host_url = urlparse(f"http://{host_header}")
        except ValueError:
            return False
        if origin_url.hostname is None or host_url.hostname is None:
            return False
        if origin_url.hostname != host_url.hostname:
            return False
        if origin_url.port is not None and host_url.port is not None:
            return origin_url.port == host_url.port
        return True

    @staticmethod
    def _category(path: str, method: str) -> str:
        if "/auth/" in path:
            return "auth"
        if "/search" in path:
            return "search"
        if "/agents/" in path:
            return "agents"
        return "write" if method not in {"GET", "HEAD", "OPTIONS"} else "read"

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
