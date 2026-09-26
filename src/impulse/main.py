"""ASGI entrypoint for Impulse."""

import uvicorn

from impulse.bootstrap.app import create_app

app = create_app()


def run() -> None:
    """Run the development API server."""
    uvicorn.run("impulse.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    run()
