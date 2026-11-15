# React reference QA handoff (current PR scope only)

Tests in `components.test.tsx` are **authored**, not executed or included in the current `frontend/` Vitest root. They must be moved to an exclusively claimed frontend feature during integration. A green source inspection does not prove functional correctness.

## Independent testing steps

1. Check that React 19 / TypeScript 5.9 / Vitest / Testing Library are installed from `frontend/package-lock.json` without modifying dependencies.
2. Copy the `react-reference` files into a dedicated, exclusive frontend feature directory *only after successful coordinator claim*. Avoid global `styles.scss`, `App.tsx`, `main.tsx` and conflicting agent files.
3. In that feature directory run TypeScript typecheck, ESLint, component Vitest, and the production build. Fix code or tests if failures occur, using the exact commit SHA in the evidence.
4. For Chromium **and WebKit**, use actual browser tests for native `dialog` focus trap and Escape; jsdom has only an explicit `showModal/close` shim. Also test popover and drawer with screen readers and click/touch.
5. Screenshots at 320×720, 390×844, 1024×768, 1422×803, 1440×900 in light/dark. Do not claim 1:1 without approved Apple kit source frame ID and pixel overlay.
6. Contrast, forced colors, reduced motion, reduced transparency, keyboard-only tab order, 200% zoom, long Russian labels and non-ASCII data.
7. Verify all Impulse role permission boundaries, API-driven values and original business event handlers. The demo contains no real domain logic.

## Acceptance table

| Component | Component tests | Browser/visual tests | Native equivalence |
|---|---|---|---|
| ControlButton | busy/disabled semantics | pressed/focus/touch | web-only |
| SegmentedControl | arrow/home/end, skip disabled | roving focus, ARIA | web-only |
| SearchField | label, update, clear | iOS keyboard, search/results | web-only |
| ActionDialog | lifecycle mocked in jsdom | showModal, focus trap/Escape | browser-native dialog, not UIKit |
| NavigationDrawer | callback mocked | backdrop, focus restore, 320px | browser-native dialog, not UIKit |
| StatusNotice | loading/error roles | accessible announcement | web-only |
| GlassControl | control class | dark/clear/reduced transparency | CSS approximation only |
| ContentSurface | semantic section | legibility and contrast | standard web material |

## Known design constraints

- Never use Liquid Glass across permanent data cards, table bodies, courses or evidence.
- No Apple-owned SF symbols/fonts/brand graphics in web bundle.
- Dialog renders inside `.aui-kit`; if a future codebase portals it elsewhere, copy CSS variables to portal root or pass theme explicitly.
- For dialogs opened by keyboard shortcuts, restore focus to the invoking control if still connected. For destroyed invokers, choose a safe destination.
- All input and command actions must preserve real authorization checks and never substitute client-side “success” for server acknowledgment.

Sources: https://developer.apple.com/design/resources/ and https://developer.apple.com/design/human-interface-guidelines/materials .
