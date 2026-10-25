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
