# Pixel home real data adapter and theme state design

## Source mapping
| UI field | API/source of truth | Failure behavior |
|---|---|---|
| Active role and module | `DevelopmentOverviewView.roles` and `next_outcome` | Display unknown role / selection CTA |
| Impulse L0–L3 level | `loadRoleLevel(trackKey)` | Unknown, never fabricate L0 |
| Courses for next level | `ImpulseRoleLevel.completed_courses / required_courses` | Hide course completion percentage |
| Current module lessons | `loadLearningSummary()` course matching `next_outcome.target_key` | Hide progress if no matching course |
| Verified skills | `/api/v1/me/talent-passport` skills with confirmed_case_count > 0 | Unknown, not zero |
| Active task and next CTA | `resolvePixelPrimaryTarget(overview)` | Stale / dispute -> safe trajectory fallback |
| AI Buddy shortcut | Server-supplied `buddyAvailable` | Hidden from shortcuts when unauthorized |
| Search, streak, notifications, profile and signout | Passed existing App callbacks | Omit optional controls rather than invent data |
| Tools | Required `onOpenTools` callback | Never silently route to an unrelated destination |

## Three mode contract
`impulse-visual-mode` stores `light`, `blue`, or `midnight`. When absent, explicit legacy `impulse-theme=light` maps to light, `dark` maps to blue, and unknown/non-stored system maps to blue selected reference. Interaction writes legacy `impulse-theme` as light/dark for CSS compatibility and applies both `data-theme` and `data-impulse-visual-mode` to root.

Root mode effect must be mounted **instead of**, not alongside, the old topbar theme controller for the same user; the integration owner reconciles that state in the shared App. Storage events update cross-tab and custom mode events synchronize controls within the same tab. No direct modification to legacy theme code here.

## Integration sequence
1. Acquire/change shared component claims (App, navigation, theme control, participant entrypoint).
2. Lift existing `DevelopmentOverviewView` from the authorized home query and mount `PixelParticipantShell` as the sole participant home/topbar. Pass real actor name/avatar and existing callbacks; do not duplicate topbar.
3. Wire left-edge hover and brand navigation to the current server-authorized CalmSidebar.
4. Preserve public verification and auth/login routes as current.
5. Test 1422×803 and 390×844 pixel comparison against owner screenshot; test three visual mode icons, text/CTA, empty states and all six roles' header affordances.
6. Run full CI and independent design review on exact integrated SHA. Only release after approved merge; no implicit Railway deploy from this PR.

## Source boundaries
The reference is the user's exact screenshot, original generated blue wave and principles of macOS 27 UI Kit. It does not reuse copyrighted Apple app graphics or distribute proprietary fonts.
