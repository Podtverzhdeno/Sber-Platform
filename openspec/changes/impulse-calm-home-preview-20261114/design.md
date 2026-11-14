# Design — Calm Participant Home (review-only)

## Current state

`ParticipantHomeV2` loads the authorized development overview from `/api/v1/participant/me/development-overview`, then renders a large illustrated hero, two additional cards, a second next action and a 2×2 informational grid. It also loads the skill passport and role Impulse level from their existing APIs and can open canonical tasks, courses and the Trajectory. Existing E2E checks use the legacy `home-v2` layout and screenshots.

## Decisions

1. **One page, one main action.** Make a calmer working surface: page heading, hero containing the real highest-priority actionable item, a three-metric factual summary (only available data), active work list, weekly focus, current Impulse level and optional skill/AI utility row. No stock illustrations, duplicated large CTA, glow, or chart decoration.
2. **On-demand detail.** Full requirements of the next Impulse level, including the required course list and practice, expand only on request. The fetch for course names/lesson state is deferred until requirements are opened, but the core role level request remains independent.
3. **Honest data.** Activity, courses, level, project work and verified skills use existing API results; unavailable data display a neutral unavailable state. No mixing career grade with Impulse level, no invented target or manual verifications.
4. **Preview-only rollout.** `?home=calm` selects the new screen only for participant home. The default `ParticipantHomeV2Body` and all existing routes stay intact. This allows user comparison before further changes. Do not edit `App.tsx`, global CSS, sidebar, backend or Railway.
5. **Accessible first.** 44px touch buttons, labelled shortcuts, keyboard-selectable weekly days, semantic headings and progress, reduced motion, clean 320px layout, real empty/loading/error states.
6. **Technical boundary.** New `calm-home/CalmParticipantHome.tsx` + `calm-home/calm-home.scss` and a very small entrypoint conditional in `participant-home-v2/page.tsx`. Reuse existing `OpenTarget` and `onOpenWorkspace` contract.
7. **Safe rollback.** Without `?home=calm` the existing page is unchanged; branch not deployed and stays draft pending user approval.

## UI hierarchy

- L0 header: «Главная», current role, one quiet subtitle.
- L0 focus card: next actionable task/course/trajectory with ONE filled button; status and provenance.
- L0 brief factual overview: Impulse level, active tasks, confirmed competencies (or unknown).
- L0 working area: small current tasks list and weekly focus.
- L1 «Мой уровень» details: requirements and exact courses, learning status and practice; no hidden blockers.
- L1 contextual shortcuts: «Траектория», «Задачи», «Портфолио», optionally «AI Buddy».
- L2 detailed trajectories, projects, course content, skill passport in their real destination screens.

## Testing/risks

- Old legacy snapshots must remain unchanged when `home=calm` absent.
- Unit tests for next CTA, empty, unknown level, on-demand course list and no fake grade.
- Build/lint/TypeScript/format on exact branch SHA, independent review and browser screenshot once deployed to a review-only environment with owner authorization.
- Rendering must not duplicate backend calls or silently make any mutating API request.
