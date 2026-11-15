# Source-to-Impulse mapping (implementation handoff)

## Current code surface
| Official Apple reference family | Existing Impulse target | What to compare | Must preserve |
|---|---|---|---|
| Liquid Glass navigation layer | `frontend/src/app/apple-web-ui.scss`; `overlay-navigation.scss` | elevated toolbar vs quiet content, blur, vibrancy, contrast | legibility, theme, reduced transparency |
| macOS/iPadOS sidebar | `frontend/src/features/calm-navigation/Sidebar.tsx` | reveal/dismiss, compact/full width, selection, scrim | real role-scoped route set and focus restoration |
| Toolbar/search | `frontend/src/App.tsx`; `frontend/src/features/owner-live-pixel/` (when merged) | search 42–44px web baseline, avatar, icons, visual density | Cmd/Ctrl+K, actual authenticated search and notifications |
| Buttons, list rows, disclosure | `frontend/src/features/apple-surface/AppleSurface.tsx` | normal/hover/focus/disabled/loading and source geometry | keyboard semantics, existing handler permissions |
| Three-mode shell | `frontend/src/app/theme-controls/`, `frontend/src/features/pixel-reference/` | light/blue/midnight and persistence | no flash, back/reload, user settings |
| Messaging | existing messaging feature and styles | conversation/list split, bubble groups, composer, responsive | message permissions, delivery/read statuses; never fake send |
| Task/project/course catalogs | existing `frontend/src/features/` routes | grouped rows, contextual actions, inspector | backend values, evidence states, routing |
| Dialog/sheet/popover | existing modal and overlay UI | placement, hierarchy, Escape, focus trap, backdrop | destructive-action confirmation; no silent server mutation |

The source of truth for the **approved Impulse screen** is `docs/design/impulse-reference-fidelity-audit-20261115.md`, with owner-supplied screenshot and geometry. The Apple gallery is a **supporting library**, not a mandate to restyle that approved mockup.

## 1:1 implementation process

1. Download platform kit from Apple's **Design Resources**; record filename/version and Apple licensing.
2. Measure the exact selected library component (frame, padding, radii, typographic styles, strokes, fill opacity, states and icon bounds). Document those values per variant. Do **not** substitute gallery demo numbers.
3. Record responsive constraints and semantic roles. Pick web equivalents (native button/input/details/dialog or audited React component).
4. For glass: prefer floating interactive overlays only; keep large reading and data surfaces standard. Browser `backdrop-filter` cannot duplicate Apple's native environment-dependent refraction.
5. Check current design tokens and naming conflicts before any changes. Keep changes scoped to claimed files, avoid a second global `:root` cascade.
6. Preserve all real handlers/permissions/links; never replace a real component with decorative HTML.
7. Compare screenshots at same viewport (1422×803 desktop, 390×844 mobile plus 320px), device scale factor, theme, data fixtures and motion settings.
8. Record visual diffs, browser-only limitations and separate independent reviewer decision in the PR.

## Required handoff deliverables
- File/component mapping table including exact Apple source frame ID or section.
- Token diffs and measured values with provenance.
- Screenshot baseline + overlay difference for light/dark and each meaningful state.
- Keyboard/ARIA/mobile/reduced-transparency checks.
- Exact Git SHA test report and rollback pointer.

### Do not do
- copy proprietary Apple assets into public repository without verifying license;
- claim web implementation is native Liquid Glass;
- import gallery CSS into production globally;
- modify active claims, shared App, routes, business logic or Railway as part of this reference-only task.
