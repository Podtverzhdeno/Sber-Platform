# Published rating data integrity

The participant ranking is a read-only projection of the published recognition season. It must never infer awards, skills, grades, or score entries from UI activity.

## Canonical read path

1. `GET /api/v1/rating-seasons` exposes only non-scheduled published seasons. When there is no season, render an honest empty state (no sample users or invented points).
2. `GET /api/v1/rating-seasons/{season_id}/leaderboard` supplies order, names (or anonymized aliases), points, accepted project counts, trophies and offers. UI filtering and ordering must operate only on that response.
3. The current user's position can be marked only when the backend returns a public `person_id` equal to the authenticated participant ID. Anonymous profiles have no clickable identity.
4. Grade and Skill Passport follow their own verification policies; earning a course certificate or claiming event participation does not implicitly award them.
5. All rating score/policy updates invalidate participant read projections on successful commit; reloading should never restore a hard-coded fallback ranking.

## Acceptance checks

- No season: empty list, no rank in topbar, no fixed score or participant names.
- Open season: rankings, public trophies and project counts match the published API response.
- Anonymized participant: may be included in totals but cannot be opened as a profile.
- Event claim: provisional state until verification; no automatic permanent points.
- TypeScript, linter, backend recognition API tests, unit tests and Chromium desktop/mobile scenarios must pass before deployment.

**Note:** Program privileges are informational until an independently published award policy grants them.

Task stage plans and provisional event claims must not count toward score-ledger entries until the required reviewer or operator decision is committed.

## Synthetic demo participants

The sample `demo-autumn-2026` season contains **ten fictional personas** with a
`demo_seed` origin and `provenance.synthetic=true`. The demo seed explicitly
grants `public_rating` consent and visibility to those ten sample participants
so the ranking UI can display distinct names and initials instead of ten
identical anonymous rows. This is not a global opt-in or a changed default for
real accounts. The public leaderboard still relies solely on `public_rating`
visibility in the SQL store.

Seed is **default data, not an override of a user's choice**: conflict handling
for `visibility_settings` and `consents` ignores existing rows rather than
restoring public visibility after a participant changes consent. Runtime
revocations take precedence, and anonymous public rows never expose a
`person_id` or any name coming from the API. The UI uses a place-based
anonymous label (e.g. `Участник №4`) and disables private profile actions.

The production validation of 26 October 2026 exposed a deployment gap:
the `main` commit with demo public-rating defaults deployed successfully, yet
the live API still returned ten anonymous people. The runtime Dockerfile had
been running **Alembic only**, while the intended optional Railway
`preDeployCommand` was not observable as an applied seed operation.

The Docker container now invokes `python -m impulse.bootstrap.predeploy`
**before Uvicorn**. This module upgrades Alembic, checks `DEMO_MODE`, and
when enabled performs the existing idempotent demo seed and catalog checks.
If seeding fails, the container does not serve a stale application.
`DEMO_MODE=false` still skips all synthetic data changes. Already recorded
privacy opt-outs remain authoritative on reseed. Never force visibility on
real users or bypass the deployment gate.

For release acceptance, check
`GET /api/v1/rating-seasons/{demo-season-id}/leaderboard` on the *actual live
domain*, not just mocked Chromium tests. Verify ten distinct synthetic names
where publication is allowed and that anonymous records remain closed.
