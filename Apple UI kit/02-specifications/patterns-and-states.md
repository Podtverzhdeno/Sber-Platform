# Apple-inspired patterns, screens, and behavior

## Desktop shell (macOS-like)

- Window canvas and persistent sidebar.
- Toolbar aligned to content; back button, centered title optional, search/actions right.
- Content is visually primary; toolbar and floating controls can use regular glass.
- Current navigation item has selection state, row icon + short label.
- Use typography and whitespace; avoid random color fills.
- No imitation of macOS traffic-light controls inside website browser canvas unless implementing an actual desktop window.

## Chat (Messages-like)

Three responsive layouts: full desktop conversation list + thread + optional details; tablet split view; mobile list OR thread. Messages use solid/tinted bubbles rather than all-over glass. Composer may be translucent with stable contrast, send action is accessible; empty, loading, attachment, failed delivery, retry, unread states. Maintain timestamp clarity, alignment and long text wrapping.

## Search + Spotlight-like interaction

Search field launches results popover/overlay (not an OS-wide Spotlight impersonation); keyboard Ctrl/⌘+K, arrow navigation, Enter select, Esc close; roles combobox/listbox as applicable; async loading and no-results messages. Respect current app permissions; never show restricted records.

## Analytics

Keep graphs, tables and KPI cards on solid surfaces for readability. Glass belongs to global functional navigation, toolbar filter or overlay. Show sorting state, filter selected state, skeleton, stale data, error, empty. Prioritize WCAG readable text.

## Forms

Toolbar or section header + labeled fields + grouped controls + fixed action semantics. Validation near field, with aria-describedby. Destructive action requires confirmation; don't rely on color only. Responsive sheet may become full-screen on mobile; Esc and focus return.

## Modal, sheet and popover

- One active top-layer at a time.
- Appropriate role, label and keyboard trap for modal; click outside only where non-destructive.
- Prefer anchored popover for contextual choices, modal for critical confirmations, sheet for secondary flow.
- Respect reduced transparency/forced-colors.
- Provide fallback in browsers without backdrop-filter.

## Standard state matrix (capture screenshots for each)

| Dimension | Values |
|---|---|
| Theme | light, dark, auto |
| Viewport | phone 390px, tablet 820px, laptop 1280px, desktop 1440px |
| Interaction | idle, hover, active, focus-visible, open, selected, disabled |
| Data | loaded, skeleton, empty, loading, error, stale |
| Accessibility | 200% zoom, reduced-motion, forced-colors, keyboard only |
| Language | Russian long strings, English fallback |
| Surface context | plain canvas, image, long scrolling content |

**All numeric viewport examples are internal test fixtures, not official Apple screen frames.**
