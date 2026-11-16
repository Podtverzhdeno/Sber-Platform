# Impulse / Results / Achievements — actual route audit, 2026-11-16

Reference: Apple HIG Lists and tables, Materials, Layout; local `Apple UI kit/06-cases/06-data-and-dashboards/README.md` and mobile-adaptive cases.

The participant renders `ParticipantAchievementsGallery` from `gallery-page.tsx`, not the legacy `.achv-page`. Hence existing Apple-shell styles for `.achv-page` leave the real achievements hero, metrics, controls, cards, drawer and add dialog night-colored in the light mode.

Implementation: light-scoped solid content surfaces; dark readable foreground, bounded pastel category accents; preserve cards/filters/search, route-backed details, source evidence, drawer/material actions and privacy. Dark/blue modes untouched. No invented achievement counts.

Acceptance: 3 modes × 320/390/1440 Chromium E2E using mock portfolio contributions, verified card/heading contrast, details drawer and Materials tab, Add Achievement dialog, no horizontal document overflow. Mobile touch targets >=44px for controls. The test is isolated from backend and does not claim pixel parity with proprietary Apple components.
