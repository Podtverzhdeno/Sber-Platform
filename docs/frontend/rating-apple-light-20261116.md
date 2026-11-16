# Impulse — рейтинг: Apple-inspired light appearance audit (2026-11-16)

Sources: `Apple UI kit/06-cases/06-data-and-dashboards/README.md`, `Apple UI kit/06-cases/07-mobile-adaptive`, official Apple HIG Lists and tables / Layout / Materials.

## Findings
- Shared shell already corrected the main hero and three top benefit tiles, but list rows, rank badges, filters, account profiles, reward showcase and modals still contained hard-coded near-black backgrounds and near-white foregrounds in light mode.
- 3 reachable views: `list`, `benefits`, `profile`. Profile privacy, publishing and season ranking are server-sourced; preserve.
- Replace neon/glow surfaces with white and tinted material, use neutral dark body ink and limited gold/silver/teal indication; keep existing trophy SVGs as de-emphasized art.
- Preserve dark/blue modes. Restrict modifications to `:root[data-theme="light"] .ir-page`.
- Ensure 44px touch filter buttons, keyboard focus, mobile no horizontal document overflow and WCAG AA contrast on primary labels.

## Acceptance
New Chromium test: 3 visual modes × 320/390/1440, list filtering, award dialog, benefits and profile navigation, computed background + primary text WCAG contrast and document overflow. Isolated port, no Playwright traces to avoid test-workspace disk exhaustion.

Do not imply pixel-parity with Apple's proprietary UIKit. No data/API mutation, and no fabricated ranking. Other sections remain independent audit tasks.
