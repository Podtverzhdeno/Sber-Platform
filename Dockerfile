# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.8.22 AS uv-bin

FROM python:3.13-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=uv-bin /uv /uvx /bin/
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src/ ./src/
COPY migrations/ ./migrations/
COPY alembic.ini ./
RUN uv sync --frozen --no-dev

COPY --from=frontend-build /build/frontend/dist ./frontend/dist

RUN rm -rf \
        /usr/local/lib/python3.13/ensurepip \
        /usr/local/lib/python3.13/site-packages/pip \
        /usr/local/lib/python3.13/site-packages/pip-*.dist-info \
        /usr/local/bin/pip \
        /usr/local/bin/pip3 \
        /usr/local/bin/pip3.13 \
    && addgroup --system impulse && adduser --system --ingroup impulse impulse \
    && chown -R impulse:impulse /app
USER impulse

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn impulse.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
