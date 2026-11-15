<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 08 — Accessibility states and nonvisual UX

**Official refs:** [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [Color](https://developer.apple.com/design/human-interface-guidelines/color).

## Cases

1. Keyboard-only navigation, Escape dismissal and deliberate return focus.
2. Form validation using `aria-describedby` and a visible text error, not red alone.
3. Light/dark/system; theme changes without unexpected layout shift.
4. `prefers-reduced-motion: reduce` — disable decorative animation.
5. `prefers-reduced-transparency: reduce` — solid fallback; forced colors.
6. WCAG AA color contrast: text at least 4.5:1 except large text at least 3:1; component boundaries/focus at least 3:1 where applicable.
7. 200% zoom and RU localization with large content; keyboard nav does not hide controls.
8. Screen reader announcement for loading completion, errors, send and retry.
9. Touch and pointer targets large enough to use reliably.
10. Loading, empty, offline, forbidden, expired-session, save-conflict and success states.

## Deliverables for integration PR

Screenshot matrix with viewport, theme, screen, state, browser; Playwright/axe scan and manual keyboard audit. `aria-modal` means actual focus handling, not only a CSS overlay.
