# App integration handoff — pixel dashboard (owner screenshot image(3).png)

The design files have already been merged into main via PR #175. PR #176 adds the real data controller. **Neither PR mounts the screen yet.** Do not treat this handoff as proof of a production UI change.

## Ownership / shared-files gate

As of main `371f6cce`, the following active claims reserve their shared files:
- `UI-APPLE-INTEGRATE-20261114`: `frontend/src/App.tsx`, `App.test.tsx`, `main.tsx`, theme controls, global screen layout and CalmSidebar.
- `UI-ALL-APPLE-20261114`: overlapping App, theme controls, CalmSidebar.
- `UI-CALM-HOME-20261114`: `participant-home-v2/page.tsx` and `calm-home/**`.

The owner/integrator MUST reconcile these claims before editing those files. Do not amend/overwrite their branches automatically. Backend and Railway are out of scope.

## Main architecture boundary

`App.tsx` owns the authenticated toolbar/search/notifications/theme and `Workspace`. `Workspace` owns the authorized sidebar and the current `ParticipantHomeV2` route. The new `PixelParticipantShell` contains **both toolbar and content**, so the integration must replace the existing authenticated toolbar **for that route** rather than nesting two headers. Do not hide one with a blanket global `display:none` rule that affects other roles or public verification.

For a minimum safe integration:
1. Preserve `<CalmSidebar role={actor.active_role} navigation={navigation} activeIndex={sectionIndex} .../>` and its authenticated route list.
2. Keep the existing `ParticipantHomeV2` overview loading/error/legacy rollback for a guarded rollout.
3. In the logged-in participant home route, provide `PixelParticipantShell` a **real** `DevelopmentOverviewView`, either from the existing `overviewQueryKey` query cache or the same shared query.
4. Pass actual `actor.display_name`, `roleLabels[actor.active_role]`, real avatar if available, current `search`, `searchItems`, notification unread count and authorized callbacks. Do not fabricate a streak counter or an avatar image from the screenshot.
5. Reuse `ParticipantHomeV2`'s current `onOpenTarget` mapping:
   - course → `Bootcamp?course=…&role=…`
   - task → `Задачи?task=…`
   - tasks → `Задачи`
   - trajectory → user's authorized `Траектория` route.
6. Bind `onOpenTools` to the **real authorized tools chooser or route**, not a fake section. Hide unauthorized menu actions; pass ranking/help/profile/logout callbacks from current App.
7. Bind the brand `onOpenNavigation` to an explicit opener on the existing CalmSidebar. Preserve left-edge hover for desktop and touch/keyboard navigation for mobile.
8. Replace only the authenticated header theme control with `usePixelVisualMode`; maintain the login-theme control and avoid racing the existing `applyTheme(themeChoice)` effect with `applyPixelVisualMode(mode)`. The mode key is `impulse-visual-mode` and legacy CSS `data-theme` is updated by the hook.
9. Match the **actual rendered React app** at 1422×803 against user screenshot. Do not rely on the standalone HTML preview for final pass: it uses demo data and different CSS selectors. Also verify 390px width, all three theme states, zero-data and unavailable-data cases.

## Current real hook surface

```tsx
const { model, loading, partialData, trackKey } =
  usePixelLiveDashboard(overview, buddyAvailable);
const { mode, setMode } = usePixelVisualMode();
// PixelParticipantShell already composes these two hooks with
// ImpulsePixelReference; no second data fetch or mock mapping is needed.
```

`PixelParticipantShell` expects `overview`, identity, search handlers, notification/navigation handlers, `onOpenTarget`, `onOpenWorkspace`, and **required** `onOpenTools`; optional streak/ranking/help/profile/logout callbacks are only rendered where present. If the exact next course is not in `loadLearningSummary()`, its lesson progress is hidden, not invented.

## Independent acceptance checklist

- [ ] Main runtime authenticated participant home contains one toolbar, one primary CTA, one trajectory card and no duplicate logos.
- [ ] Desktop hover edge panel slides out; click brand and keyboard remain usable without a visible "Меню" label.
- [ ] Search, unread notifications, leaderboard, streak and profile callbacks are bound to current authenticated data.
- [ ] Sun / Blue Moon / Dark Moon click sequence persists across reload and is consistent with the rest of Impulse.
- [ ] Live participant tasks, Bootcamp course progress, confirmed skills and L0→L1 read from existing APIs; pending review is not submit.
- [ ] Screenshot diff at 1422×803 and 390×844 accepted by an independent reviewer.
- [ ] Run lint, TypeScript, isolated Vitest, production build, Playwright six-role regression on **integration** SHA.
- [ ] Full CI and Railway release gate independently reviewed before deployment.

**Release state:** No-Go until the above checks are complete. Source integration is not production proof.
