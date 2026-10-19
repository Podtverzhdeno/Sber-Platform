"""Production delivery of the compiled single-page application."""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING, cast

from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles
from starlette.types import ExceptionHandler, Scope

from impulse.api.errors import error_for_exception

if TYPE_CHECKING:
    from fastapi import Request
    from starlette.exceptions import HTTPException as StarletteHTTPException
    from starlette.responses import Response

_FILE_EXTENSION = re.compile(r"\.[A-Za-z0-9_-]{1,16}$")
# Paths that always keep the JSON error envelope and are never served as SPA routes.
_GUARDED_PREFIXES = ("/api", "/health", "/metrics", "/agents", "/config")


class SinglePageApplication(StaticFiles):
    """Serve static assets; extensionless misses fall back to index.html."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            response = await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code == 404 and not _FILE_EXTENSION.search(path):
                return await super().get_response("index.html", scope)
            raise
        if response.status_code == 404 and not _FILE_EXTENSION.search(path):
            return await super().get_response("index.html", scope)
        return response


def install_spa_fallback(app: FastAPI, directory: Path) -> None:
    """
    Serve the compiled SPA without a catch-all mount.

    Starlette routes check in registration order, so a `Mount("/")` would swallow
    every later-registered route and every unknown-path 404 envelope. Instead the
    fallback only reacts through the unmatched-path exception: assets resolve
    from `dist`, extensionless HTML navigations receive `index.html`, and every
    guarded prefix keeps the JSON error envelope.
    """
    static = SinglePageApplication(directory=directory)

    async def spa_or_envelope(request: Request, exc: StarletteHTTPException) -> Response:
        path = request.url.path
        accepts_html = "text/html" in (request.headers.get("accept") or "")
        guarded = path.startswith(_GUARDED_PREFIXES)
        if (
            exc.status_code == 404
            and not guarded
            and request.method in {"GET", "HEAD"}
            and _serve_allowed(path, accepts_html)
        ):
            try:
                if _FILE_EXTENSION.search(path):
                    return await static.get_response(path.lstrip("/"), request.scope)
                return await static.get_response("index.html", request.scope)
            except HTTPException:
                pass  # Asset lookup failed: keep the stable envelope instead.
        return error_for_exception(request, exc)

    app.add_exception_handler(HTTPException, cast(ExceptionHandler, spa_or_envelope))


def _serve_allowed(path: str, accepts_html: bool) -> bool:
    return accepts_html or bool(_FILE_EXTENSION.search(path))
