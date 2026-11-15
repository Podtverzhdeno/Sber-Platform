# Apple UI Kit → Impulse integration backlog, isolated by component family

These are **follow-on tasks**: none is a claim that application integration has happened. Respect root AGENTS.md claims and owner-approved screenshot dimensions. Never change existing shared App.tsx, theme or authorization code from the reference-folder claim.

| Order | Scope | Apple source frame needed | Impulse target | Acceptance |
|---|---|---|---|---|
| 01 | Floating toolbar | macOS 27 toolbar, regular glass, two themes and focus | All-role toolbar | 1422×803 overlay; real search/notifications; escape/focus; three owner themes |
| 02 | Temporary sidebar | macOS 27 sidebar, overlay + interactive states | Role drawer | Hidden at rest per owner, no layout shift, six-role permissions, 320/390/1024/1440 |
| 03 | Search field | iOS/iPadOS + macOS 27 search field / scopes | Global search/catalogs | Live API results; keyboard clear/focus; role gating; loading, no-results, error |
| 04 | Prominent/neutral button | iOS/iPadOS 27 fill and border variants | Primary and secondary CTA | One dominant action/group, disabled/loading/focus, no misleading actions |
| 05 | Segmented controls | iOS 27 segmented variants | Filters and view mode | Keyboard arrows/selected state; URL / query semantics unchanged |
| 06 | Menu and popover | macOS 27 menu and profile popover | Avatar/context actions | Outside click, Escape, focus return, accessible labels, no nested popovers |
| 07 | Sheet/confirmation | iOS 27 sheet, macOS 27 sheet | Task terms/review confirmations | Safe cancel/confirm, no loss of unsaved edits, human decisions only |
| 08 | Grouped list | iOS 27 list; macOS 27 list | Bootcamp and project rows | No glass on content, text wrap, source data, empty/error/selected states |
| 09 | Data table | macOS 27 table / inspector | Mentor/HR/Operator lists | Sort correctness, headers, loading, permission/consent, dense responsive layout |
| 10 | Messaging | Messages template + macOS split-view patterns | Messages and AI Buddy | Correct unread, attachments, no message leaks, real composer handlers |
| 11 | Credentials | Wallet template card geometry | Skill Passport and portfolio | Verified status source, revoked visibility, consent and source links |
| 12 | User guidance | TipKit template | On-demand help | Dismissible, not automatic nag, keyboard and reduced motion |
| 13 | Progress summaries | Live Activities template (analogy only) | Course/project status | Truthful denominator and freshness; no fake Live Activity system integration |
| 14 | Responsive / accessibility | HIG accessibility, typography, motion | All six roles | 320/390/1024/1422/1440, 200% zoom, light/dark/reduced transparency, ARIA |
| 15 | Full role integration | Measured kit frames + approved owner UI | Participant/Customer/Mentor/Manager/HR/Operator | Route-by-route screenshots, zero business regression, independent review |

## Definition of ready for any real code task

1. Actual official Apple 27 Figma/Sketch file and frame ID/version known; license and font conditions checked.
2. The owner has identified the precise target Impulse screen/reference and allowed deviation.
3. No overlapping active claim on the exact files; a new exclusive write scope is recorded.
4. Source screenshot/crop verified at same viewport, DPR, browser and synthetic/real authorized fixture.
5. Component behavior specification has keyboard, pointer, focus, disabled, errors, rights/consent and API source truth.
6. Pixel diff, lint/typecheck/tests and reviewer plan established.

## Definition of accepted

- All required source states recorded with measured numbers and provenance; original Apple assets not redistributed.
- Target Impulse UI screenshot at exact revision compared to source/owner frame via overlay/diff and reviewed.
- API, user actions, six-role RBAC, authorization, human verification and privacy never replaced by mockups.
- Relevant browser E2E, unit tests, accessibility keyboard/focus and reduced effects pass.
- PR independently reviewed; only then may a separate integration task merge. Railway deployment requires its own approval/gate.
