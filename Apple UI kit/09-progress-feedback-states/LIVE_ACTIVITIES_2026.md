# Updated Apple Live Activities reference — 2026-11-06

**Official source:** https://developer.apple.com/design/whats-new/

Apple announced refreshed Live Activities design kits in **Figma and Sketch for iOS 27**, now with **macOS examples and components**. The official entry is Technologies → Live Activities Template: https://developer.apple.com/design/resources/.

## Impulse web analogues (not native OS Live Activities)

| Use case | Must be authentic source | States to measure/test |
|---|---|---|
| Course in progress | Enrolled course and real progress | active/completed/stale/unknown |
| Project deadline | Milestone with server date and timezone | due/overdue/closed/no date |
| Mentor review | Assigned human reviewer and review state | pending/in review/published |
| Evidence verification | Source-linked record | pending/rejected/verified/revoked |

A web compact progress strip is **not** an Apple system Live Activity. Never invent a percentage, human decision, deadline, or verified state.

## Source measurement queue

1. Open current Apple official Figma or Sketch template with applicable license.
2. Record platform (iOS 27/macOS), exact design frame ID, variant, state, theme, dimensions and export scale.
3. Record typography, contrast, material, padding, radii, timing and resizing behavior from source.
4. Compare Impulse screenshot at matching viewport and DPR; assess light/dark, focus, narrow/mobile, error/stale.
5. Document actual differences and independent QA evidence.

**Status:** public update verified; editable kit frames, source measurement, screenshot diff, React integration **PENDING**.
