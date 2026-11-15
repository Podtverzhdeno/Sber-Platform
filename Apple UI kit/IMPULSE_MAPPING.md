# Mapping Apple reference patterns to the *existing* Impulse app

This is a **planning/reference document**, not an instruction to overwrite current JSX/CSS. At 2026-11-15 `main`, Impulse uses React 19/TypeScript/Vite with role-based routes. UI composition and actual source-backed data must stay governed by existing app contracts.

## Verified existing touchpoints

| Existing file in Impulse | Relevant Apple study | Modification policy |
|---|---|---|
| `frontend/src/app/apple-web-ui.scss` | system palette, macOS-like toolbar, controls, cards | Already exists, do not replace wholesale |
| `frontend/src/app/impulse-next.scss` | layout and shared shell | Shared integration lane only |
| `frontend/src/app/overlay-navigation.scss` | temporary sidebar/glass control layer | Shared integration lane only |
| `frontend/src/features/calm-navigation/Sidebar.tsx` | menu/drawer, focus management | Already claimed by parallel work |
| `frontend/src/features/pixel-reference/ImpulsePixelReference.tsx` | owner-approved screenshot study | Respect owner pixel-source geometry |
| `frontend/src/features/owner-live-pixel/` | owner-approved live shell adaptation | Owner-driven work; no overlap |
| `frontend/src/components/ui.tsx` | buttons/cards/badges/list patterns | Change only with explicit shared component claim |
| `frontend/src/styles.scss` and `frontend/src/main.tsx` | tokens/import ordering | Shared surfaces; no reference-kit editing |

## Six roles: mapping matrix

| Product area | Apple UI inspiration | What **must not** regress |
|---|---|---|
| Participant home/trajectory | native toolbar, learning progress, segmented choices, grouped list, TipKit-like context | Real level/course/evidence data; 3 owner theme modes |
| Participant Bootcamp/tasks/events | search, grouped list and selection, compact card/table | Query/filter results, course/task routes, current API status, terms |
| Participant projects/portfolio/rating | split inspector, status badge, Wallet-like credential design | Source-backed completion, visibility, accepted contribution |
| Participant messages/AI Buddy | macOS Messages split-view, compose controls, search and popovers | Thread privacy, attachments, actual unread/sources |
| Customer | desktop lists, task wizard inputs, sheets and applicant inspector | Terms versions, human publish, current staffing |
| Mentor | evidence inspector, compact review rows, segmented review queue | Human grade decisions, escalation, evidence links |
| Manager | metrics, drill-down tables and navigation | Source truth, authorized aggregates |
| HR | searchable list, candidate detail and tags | Consent restrictions and pipeline actions |
| Operator | case queue, alerts, contextual actions and audit inspector | Human final decisions, SLA and audit history |

## Data and interaction contract

- Do not replace API values, switch to handcrafted data, change route indexes or flatten RBAC into CSS.
- Preserve all existing shortcuts, search behavior, notification counts, avatar controls, theme preference, progressive disclosure and role-specific navigation.
- A visible Apple-style `Button` must use a real `<button>` and existing business handler; a design-frame rectangle is not enough.
- Native Apple system effects are **not** imported; this library supplies independent HTML/CSS reference implementation only.
- Any migration begins with a new, exclusive claim for specific integration files and an independent reviewer.

## Recommended integration order (no changes performed here)

1. Authorize and accept the Apple source frame/version and required variants for the target page.
2. Measure the official editable design and export controlled screenshots.
3. Compare against the owner's existing screenshot (if one exists); the owner reference wins for Impulse layout.
4. Ship one shared primitive at a time on isolated task branches, preserving auth/data/contracts.
5. Run 320 / 390×844 / 1024×768 / 1422×803 / 1440×900 in light/dark, focus and reduced effects.
6. Independent screenshot reviewer checks actual DOM and behavior on the exact revision before merge.
7. Production deploy remains separately approval- and verification-gated.

**Related source of truth:** `openspec/changes/apple-web-design-system-20261114/design.md`, `openspec/changes/impulse-apple-app-experience-20261114/docs/uikit-ios16-figma-reference-contract.md`, `docs/design/impulse-reference-fidelity-audit-20261115.md`. These existing documents include relevant qualifications about Apple-native versus browser approximation and existing owner pixel-reference expectations.
