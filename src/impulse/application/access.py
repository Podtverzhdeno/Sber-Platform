"""Non-disclosing object lookup used by application entry points."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, ProtectedObject


def resource_not_found() -> ApiError:
    return ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)


async def load_authorized[T](
    loader: Callable[[], Awaitable[tuple[T, ProtectedObject] | None]],
    actor: ActorContext,
    policy: Callable[[ActorContext, ProtectedObject], bool],
) -> T:
    """Return one indistinguishable 404 for absent and inaccessible objects."""
    result = await loader()
    if result is None:
        raise resource_not_found()
    value, protected_object = result
    if not policy(actor, protected_object):
        raise resource_not_found()
    return value
