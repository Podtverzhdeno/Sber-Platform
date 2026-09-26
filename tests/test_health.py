"""Application smoke tests."""

from fastapi.testclient import TestClient

from impulse import __version__
from impulse.bootstrap.app import create_app


def test_package_imports() -> None:
    assert __version__ == "0.1.0"


def test_health_live() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
