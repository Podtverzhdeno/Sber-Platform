# Design — Calm Participant Home (review-only)

## Current state

`ParticipantHomeV2` loads the authorized development overview from `/api/v1/participant/me/development-overview`, then renders a large illustrated hero, two additional cards, a second next action and a 2×2 informational grid. It also loads the skill passport and role Impulse level from their existing APIs and can open canonical tasks, courses and the Trajectory. Existing E2E checks use the legacy `home-v2` layout and screenshots.

## Decisions

1. **One page, one main action.** Make a calmer working surface: page heading, hero containing the real highest-priority actionable item, a three-metric factual summary (only available data), with work list, weekly focus and optional shortcuts collapsed behind clear one-click disclosures. No stock illustrations, duplicated large CTA, glow, or chart decoration.
2. **On-demand detail.** Full requirements of the next Impulse level, including the required course list and practice, expand only on request. The fetch for course names/lesson state is deferred until requirements are opened, but the core role level request remains independent.
3. **Honest data.** Activity, courses, level, project work and verified skills use existing API results; unavailable data display a neutral unavailable state. No mixing career grade with Impulse level, no invented target or manual verifications.
4. **Preview-only rollout.** The participant home renders CalmParticipantHome by default on the requested `determined-spirit / production` deployment. `?home=legacy` explicitly selects the original ParticipantHomeV2Body as rollback. All other routes/roles remain unchanged. This follows the user's request to update that specific production service. Do not edit `App.tsx`, global CSS, sidebar, backend or Railway.
5. **Accessible first.** 44px touch buttons, labelled shortcuts, keyboard-selectable weekly days, semantic headings and progress, reduced motion, clean 320px layout, real empty/loading/error states.
6. **Technical boundary.** New `calm-home/CalmParticipantHome.tsx` + `calm-home/calm-home.scss` and a very small entrypoint conditional in `participant-home-v2/page.tsx`. Reuse existing `OpenTarget` and `onOpenWorkspace` contract.
7. **Safe rollback.** Without `?home=calm` the existing page is unchanged; branch not deployed and stays draft pending user approval.

## UI hierarchy

- L0 header: «Главная», current role, one quiet subtitle.
- L0 focus card: next actionable task/course/trajectory with ONE filled button; status and provenance.
- L0 brief factual overview: Impulse level, active tasks, confirmed competencies (or unknown).
- L1 «Задачи и неделя»: compact one-click disclosure with current tasks list and weekly focus.
- L0 quiet one-line «Ваш уровень и следующий этап», showing actual progress when available; L1 requirements and exact courses, learning status and practice on click; no hidden blockers.
- L1 «Другие инструменты»: one-click disclosure containing «Траектория», «Скилл-паспорт», optionally «AI Buddy». No permanently visible secondary tool deck.
- L2 detailed trajectories, projects, course content, skill passport in their real destination screens.

## Testing/risks

- Old legacy snapshots remain available under `?home=legacy` and their functional invariants remain tested. New default snapshot covers the calm first fold.
- Unit tests for next CTA, empty, unknown level, on-demand course list and no fake grade.
- Build/lint/TypeScript/format on exact branch SHA, independent review and browser screenshot once deployed to a review-only environment with owner authorization.
- Rendering must not duplicate backend calls or silently make any mutating API request.

## User refinement — 14 Nov 2026

Visual direction clarified as white, futuristic, Apple-inspired minimalism. First fold deliberately retains only page context, one next action and three factual small metrics; large decorative orbit removed. Secondary work/weekly cards and utility shortcuts are native `details/summary` disclosures with visible accessible labels; the Impulse level stays as an unobtrusive short card, and full curriculum is accessed intentionally. Global navigation and other screens remain unchanged. Dark theme is supported as a user setting, but the default visual direction is bright and restrained.
