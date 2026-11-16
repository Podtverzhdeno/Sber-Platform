# Impulse / Results / Achievements — residual artwork audit, 2026-11-16

Reference: Apple HIG Lists and tables, Materials, Layout; local `Apple UI kit/06-cases/06-data-and-dashboards/README.md` and mobile-adaptive cases.

## Relation to shared Results PR #243
The participant route uses `ParticipantAchievementsGallery` (`.ach-gallery--results`), not the legacy `.achv-page`. PR #243 introduced a shared light appearance layer for Results, including achievement cards, titles, filter controls and detail panels. **Do not duplicate that layer.** This PR fixes the remaining dark *artwork canvases* in the real achievements route: badge/award art, project/certificate/event illustrations, hero holograms, detail drawer art, and the add-achievement icon. Restrict all changes to light theme and the real Results gallery.

## Acceptance
- 3 modes × 320/390/1440 Chromium E2E with synthetic portfolio fixture.
- Computed light card/title WCAG AA contrast; **pale project artwork in card and drawer**; other gallery materials readable.
- Verify detail drawer, Materials tab, Add Achievement dialog, absence of document-level overflow.
- Blue and midnight presentation unchanged.
- No route/data/API/authorization changes or fabricated production metrics. This is a HIG-inspired refinement, not a claim of pixel parity with Apple proprietary components.
