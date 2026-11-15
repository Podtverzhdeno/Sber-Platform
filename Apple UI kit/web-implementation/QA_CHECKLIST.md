# Review checklist (not a claim that tests have passed)

- Browser console: no JS/CSS errors.
- 1440×900, 1422×803, 1024×768, 390×844, 320px: no accidental horizontal scroll.
- Light / dark: all text readable, visible focus on toolbar, buttons, input.
- Reduced motion and reduced transparency: functional; forced colors: no invisible controls.
- Drawer closed initially, not focusable; button opens it and focuses Close; Tab wraps, Escape and scrim dismiss and restore focus.
- Popover opens/closes with click, Escape and outside pointer. Modal has a dismissible Cancel and Confirm.
- Tab arrow keys, Home and End move selected tab and accessible name correctly.
- Search filters demo rows; empty, error and ready states have labels.
- Clear and regular variants only over illustrative background; standard content remains opaque.
- Form error is visible and keyboard focus moves to invalid field.
- Local synthetic data never gets sent to Impulse APIs; no business action silently simulated as real.
- Native Liquid Glass, Apple font licenses and exact pixel parity not reproduced.
- Before integration use original official editable Figma/Sketch frame and measured owner screenshot, then run Playwright/contrast/keyboard/RTL/real-data checks.
