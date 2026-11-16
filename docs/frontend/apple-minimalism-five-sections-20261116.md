# Impulse — Apple minimalism across five sections (2026-11-16)

## Sources and boundaries
Ground the design in [Apple HIG Design Principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), and [Lists and Tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables).

Existing *self-authored* reference packs in the repository: Apple UI kit / 02-specifications / foundations.md; Apple UI kit / 03-impulse / integration-map.md and visual-qa-checklist.md; Apple UI kit / 06-cases / 01-navigation, 03-messaging, 04-inputs-and-controls, 06-data-and-dashboards, 07-mobile-adaptive, 11-identity-and-settings. The SVG previews are Impulse interpretations, **not** native Apple screens or exact Figma pixel measurements.

In Impulse, translucent/blurred material is justified for navigation only. Put dense content, statistics, forms, tables and evidence on solid, theme-aware, readable surfaces. Keep function and information hierarchy first: visual minimalism must not hide mandatory user actions.

## Full five-section implementation map

| Area | Authorized subfunctions to keep | Specific reference patterns | Migration and QA |
| --- | --- | --- | --- |
| Развитие | My Path, trajectories, levels, courses, Bootcamp | HIG Layout + local navigation/case packs | Compact section switcher, clear next action, solid course cards; verify navigation/Back/3 themes |
| Практика | Tasks, My Projects, applications, teams, checkpoint submissions, artifacts | HIG Lists and Tables + Inputs + Dialogs | Project workspace, terms and checkpoint light fixes through #230, #233, #235; audit remaining catalogs by actual screen |
| Результаты | Portfolio, Skill Passport, achievements, rating, analytics | HIG Materials + Dashboard / Lists | Current portfolio fix removes dark residual cards in light mode; analytics and ranking are next independent migration scopes |
| Сообщество | Events, messages, member interactions | HIG Sidebars + Messages | Group activity, preserve message delivery/access, avoid full-page redesign that obscures composer |
| Дополнительно | Settings, help, additional tools | HIG Buttons + Forms and identity | Group related preferences, retain validation/help and keyboard accessibility |

## Acceptance contract
The three existing modes are light, blue, and midnight; the root document still exposes light/dark through data-theme. Preserve all existing routes, role gates, data loading, events, and backend contracts.

Each touched screen: responsive 320/390/1440 px, no document-level horizontal overflow, computed foreground/background checks, usable focus, Escape in dialogs, and reduced-motion support. Where required, also validate 820px tablet, keyboard and 200% zoom. Errors, empty data and unconfirmed competencies must not be replaced with fabricated counts.

Pixel-perfect parity is NOT claimed without access to the exact licensed Apple component and an equally sized source-to-target screenshot comparison. Existing project QA does not replace whole-platform E2E or production smoke.

Pre-existing global CI issues to track separately: messenger visual snapshots, backend formatting, OpenSpec strict validation. Do not claim the full CI green from scoped tests.
