# Live shell design

## Exact desktop target (1422×803)
| Component | Target | Implementation |
|---|---|---|
| Floating glass toolbar | (56,0), 1310×62 | .page-shell--owner-pixel .topbar: x=50% with translateX(-50%), width calc(100%-112px), height 62 |
| Brand | ✦ + Impulse, no Menu label | .owner-topbar-brand opens existing CalmSidebar via its mounted trigger, no new menu transport |
| Search | dark translucent 645×43 | existing authenticated `search` and results preserved |
| Theme | 42px icon | `usePixelVisualMode` + `nextImpulseVisualMode`, Sun→Moon→MoonStar |
| Engagement | flame, actual streak | existing `TopbarEngagementIndicator`, not a hardcoded 11 |
| Notifications | bell blue unread dot | existing `NotificationList` + chat dedup and popover preserved |
| Account | avatar+chevron | real actor displayName + ranking/help/profile/logout actions in glass popover |
| Participant content | x143..1291, y≈98 | embedded `PixelParticipantShell`, hide its own header, start workspace content at 66px |
| Course/trajectory row | 793×252 and 334×252 | existing screenshot-measured 2.37fr / 1fr grid |
| Other 49 role routes | functional, no double toolbar | old role route components retained, only shared navigation chrome changes |

## Data safety
No numerical values are taken from the screenshot at runtime. All data are from `/api/v1/participant/me/development-overview`, `loadRoleLevel`, `loadLearningSummary`, and talent passport; unknown data are rendered unknown. The API adapter checks malformed responses defensively. Course and task target routes reuse the canonical Bootcamp / Задачи paths. Login, public verification routes and 6-role authorization are unchanged.

## Menu and accessibility
The old `calm-navigation__mobile-trigger` remains mounted to preserve its existing event/state implementation but is not visually rendered in the owner's UI. The *visible* Impulse logo invokes it; the keyboard-driven left-edge overlay still works. On closing, focus returns to the visible brand rather than attempting to focus a display:none element. Escape and click outside close profile popup; bell popover and search dropdown remain accessible. No unauthorized route is added.

## Glass fidelity and reduced motion
Liquid Glass is applied to the topbar, toolbar buttons, sidebar and account popovers; data cards use readable low-transparency panel surfaces. Original generated blue wallpaper runs beneath the canvas. There are distinct light/blue/midnight tokens. When reduced transparency or forced-colors is active, provide solid/high-contrast fallbacks. At <=570px, the brand icon remains the navigation trigger, search stays usable, and streak is hidden *visually* to preserve space.

## Production rollout and verification
- independent PR review and exact-SHA frontend typecheck, lint, unit, build, OpenSpec, architecture and Docker smoke; update affected legacy UX E2E to the owner-approved no-Menu contract, not weaken assertions
- Chromium 1422×803 and 390×844 with real mocked authenticated requests, screenshot comparison, three theme click cycle, legacy rollback and source-target navigation
- Railway production project `optimistic-energy`, service `Sber-Platform`, repo `Podtverzhdeno/Sber-Platform` branch main; do not recreate service/database or overwrite variables
- deployment success must be checked with Railway deployment SHA and direct public site, not inferred from git merge
- do not claim pixel-perfect until independent screenshot comparison has been recorded

## Owner refinements — repeated progress, help, reference material (2026-11-15)
- Main next-level summary: a single source-based percent indicator and L-current/L-next pair. No second copy of the same required-course/practice numerators in a disclosure. "План перехода" navigates to the canonical trajectory for course/practice details.
- The bottom-right ParticipantGuide launcher and all auto-triggered coachmarks are disabled in the authenticated shell, but the component and full Help Center remain mounted for explicit account-menu "Помощь". Unit tests enforce both the absence of auto UI and the presence of manual help.
- Material tokens --liquid-* are scoped to .page-shell--owner-pixel with light/blue/midnight variants. Translucent glass is functional chrome (topbar, search, avatar, disclosures, selected controls, hero), not a dark overlay on tables and evidence. Insets, borders and pointer-safe highlights preserve the measured first-fold grid. Reduced transparency and forced-colors fallbacks remain mandatory.
