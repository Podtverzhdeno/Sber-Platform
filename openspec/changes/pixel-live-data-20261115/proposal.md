# Live data and three-theme controller for Impulse pixel UI

## Intent
After owner-approved merge of screenshot-derived PR #175, eliminate the remaining gap between the visual component and authorized production data without touching shared App, home, theme or sidebar files reserved by active coordination claims.

## Current baseline
`main` contains a visible but unmounted `ImpulsePixelReference` and pure `toPixelHomeModel` source adapter. Existing participant home already fetches `DevelopmentOverviewView`; the new design must display verified skills, current course units and per-role level from the same authoritative API endpoints.

## Scope
Add a standalone connection layer:
- `usePixelLiveDashboard` with the existing role-level, study-summary, and talent-passport React Query keys
- `usePixelVisualMode` with light → blue → midnight mode persistence, legacy light/dark compatibility, same-tab and cross-tab synchronization
- `PixelParticipantShell` with real callbacks for actions, authorized search, navigation and account utilities
- focused tests and measured integration acceptance

## Out of scope / gating
No edits to `App.tsx`, global tokens, `CalmParticipantHome`, navigation, backend schemas, Railway or production deployments while those files are claimed. This PR is integration-ready but does not itself mount the new home. An independent integration owner must wire and visually compare the live screen on exact SHA.
