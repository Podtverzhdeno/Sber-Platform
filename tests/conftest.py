"""Session-wide unit-test isolation from the developer's local .env file."""

import os
from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True, scope="session")
def isolate_local_env() -> Iterator[None]:
    """
    Keep unit and API tests on memory stores.

    `pydantic-settings` gives environment variables precedence over the `.env`
    file, so overriding DATABASE_URL and SESSION_SECRET with an empty string
    turns them into their "unset" state, while integration tests keep reading
    TEST_DATABASE_URL when it is provided.
    """
    saved = {
        name: os.environ.get(name)
        for name in ("DATABASE_URL", "SESSION_SECRET", "TEST_DATABASE_URL")
    }
    os.environ["DATABASE_URL"] = ""
    os.environ["SESSION_SECRET"] = ""
    yield
    for name, value in saved.items():
        if value is None:
            os.environ.pop(name, None)
        else:
            os.environ[name] = value
