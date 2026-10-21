# Railway deployment evidence

## Deployment under verification

- Environment: `optimistic-energy / production`
- Public URL: `https://sber-platform-production.up.railway.app`
- Deployment ID: `a306c852-b6e8-47c8-8660-cbe32f6bb5ea`
- Commit: `02ccfe4a38e1891aa6a5201514824e87aada5420`
- Image digest: `sha256:cb7dd4df89372bd84fb497952513ab89a30b3b0e9c12faa0f33af6b636aadfdf`
- Smoke time: `2026-10-21T05:53:30Z`
- Owner approval: explicitly given in the project chat on `2026-10-21`

No cookie value, CSRF token, database URL, session secret, provider key, or Railway token is stored in this evidence.

## Sanitized smoke result

| Check | Result | Evidence |
|---|---|---|
| `/health/live` | PASS | HTTP 200, `status=ok` |
| `/health/ready` | PASS | HTTP 200, PostgreSQL-backed readiness succeeded |
| `/api/v1/config` | PASS | HTTP 200; `app_env=production`, `demo_mode=true` |
| Demo personas | PASS | HTTP 200, 15 synthetic personas |
| Demo login and `/api/v1/me` | PASS | HTTP 200; `participant-alex`, active role `participant` |
| Session attributes | PASS | `Secure=true`, `HttpOnly=true`, `SameSite=Lax` |
| Buddy suggestion | PASS (disabled branch) | HTTP 200, policy version 1, `ai_model_available=false`, suggestion present, `model_called=false` |
| SPA delivery | PASS | HTTP 200 with `Accept: text/html`; root mount is present |
| Migrations | PASS | PostgreSQL upgrades `0021 -> 0022 -> 0023` completed before startup |

## Performance follow-up

Repeated public timing checks show that the deployment is healthy but read latency remains unacceptable:

- `GET /api/v1/me/growth/snapshot`: 9.7–10.2 s
- `GET /api/v1/me/messaging/channels`: 14.4–20.7 s
- SPA HTML: about 149 ms

Railway status proves the application replica is in `EU West` while PostgreSQL is in `US East (iad)`. The cross-region database round trips are the primary infrastructure cause. Moving the production replica is a material infrastructure mutation and requires separate explicit owner approval.

## Required continuation

1. Obtain explicit owner approval for the regional move.
2. Run `railway service scale --service Sber-Platform us-east=1 eu-west=0 --json`.
3. Wait for Railway healthcheck success and confirm the EU replica is removed.
4. Repeat the timing smoke and require a substantial reduction in the two read paths.
5. Keep AI feature flags disabled until a provider key/free-model policy, quota, and separate controlled smoke are approved.
