"""Impulse Bootcamp · Security Data, lesson 2: JWT Authentication.

Educational starter, not a deployed authentication service.
Install: pip install "fastapi>=0.115" "uvicorn>=0.30" "PyJWT>=2.9"
Set JWT_SECRET to a strong, private secret in the environment.
Never ship a hardcoded real credential or rely on this example alone in production.
"""

from __future__ import annotations

import os
from typing import Annotated

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

app = FastAPI(title="Impulse JWT Authentication Exercise")
bearer = OAuth2PasswordBearer(tokenUrl="/token")
ISSUER = "trusted-auth-service"
AUDIENCE = "impulse-api"


def get_current_user(token: Annotated[str, Depends(bearer)]) -> dict[str, str]:
    """TODO: verify issuer, audience, expiration and signature."""
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET must be set outside source control")
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer=ISSUER,
            audience=AUDIENCE,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
    return {"id": str(payload["sub"])}


@app.get("/me")
def get_my_profile(user: Annotated[dict[str, str], Depends(get_current_user)]) -> dict[str, str]:
    # Extend this with profile retrieval from an authenticated data source.
    return user


@app.get("/projects/{project_id}")
def read_project(
    project_id: int,
    user: Annotated[dict[str, str], Depends(get_current_user)],
) -> dict[str, int | str]:
    """TODO: add a database-backed object permission check (RBAC or ABAC).

    The JWT authenticates the user, but NEVER authorizes arbitrary project IDs.
    Deny non-owners and non-members with HTTP 403.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Implement server-side object authorization before enabling this endpoint",
    )


# Checks to implement:
# 1. Missing/malformed/expired/forged JWT returns 401.
# 2. Valid JWT for /me returns the verified subject.
# 3. Foreign project ID returns 403, even with a valid JWT.
# 4. No tokens, secrets, or private fields appear in logs and errors.
