# 46-case Impulse integration crosswalk — candidate files only

**Review basis:** current `Podtverzhdeno/Sber-Platform` default branch inspected on 2026-11-15, together with existing 46-case manifest. This crosswalk is a planning companion for future independent application implementation, **not a code change or approved mapping of ownership**.

## Scope and certainty

- All **17 referenced candidate frontend files were confirmed present** via GitHub file read-back.
- `impulse-integration-candidates.json` records **46 rows**, one for every `APP-CAP-001` … `APP-CAP-046`, with category, likely target files, owner-visual precedence and regression gates.
- These are candidate edit/inspection points **only**. File existence does **not** prove the particular Apple-pattern component lives inside that file, nor authorize modifying it.
- Current role-based Impulse app state, API, permissions, theme modes and owner-approved screenshot geometry take precedence over a generic Apple-native design suggestion.

## Inspection map

| Apple design study | Existing Impulse file(s) to inspect before requesting an exclusive claim | Key risk |
|---|---|---|
| Floating toolbar, sidebar and tabs | `frontend/src/App.tsx`, `frontend/src/features/calm-navigation/Sidebar.tsx`, `frontend/src/features/owner-live-pixel/OwnerPixelHome.tsx` | Global shell is shared and is already worked on by other sessions |
| Search + contextual commands | `frontend/src/App.tsx`, `frontend/src/features/task-catalog-v2/page.tsx` | Unauthorized search results and loss of actual navigation |
| Button/select primitives | `frontend/src/components/ui.tsx`, `frontend/src/features/customer-create-task.tsx` | Form submission semantics and destructive confirmations |
| Input, pickers, validation | `frontend/src/features/customer-create-task.tsx`, `frontend/src/features/customer.tsx` | Terms, field validation and server authority |
| Data tables and lists | `frontend/src/features/task-catalog-v2/page.tsx`, `frontend/src/features/hr.tsx`, `frontend/src/features/analytics-v3/page.tsx` | Truthful API records, sorting, permitted candidate data |
| Progress and feedback | `frontend/src/features/learning-progress-panel.tsx`, `frontend/src/components/ui.tsx` | False completion and unknown-as-zero |
| Alerts, sheets and popovers | `frontend/src/App.tsx`, `frontend/src/features/mentor.tsx` | Missing focus restoration and accidental final decisions |
| Evidence inspector | `frontend/src/features/mentor.tsx`, `frontend/src/features/operator.tsx` | Cross-role access and audit evidence |
| Messages and attachments | `frontend/src/features/collaboration.tsx` | Private threads, real unread and upload safety |
| Wallet-like credential | `frontend/src/features/portfolio-v2.tsx`, `frontend/src/features/portfolio-skill-model.ts` | Verified evidence and visibility settings; **not Apple Wallet** |
| Contextual tips | `frontend/src/features/participant-help-center.tsx` | Nonintrusive, repeatable, accessible help |
| Live Activity-like web status | `frontend/src/features/engagement.tsx`, `frontend/src/features/learning-progress-panel.tsx` | Live state must derive from API; **not native Live Activities** |

## Integration checklist for every future PR

1. Confirm the source HIG/Figma/Sketch component and exact node under the relevant license; record variant and state.
2. Obtain measured source geometry and permitted screenshot export hash; do not fill blank dimensions by inference.
3. Determine the precise owning React file and claim it exclusively after checking current `AGENTS.md`, `git status` and active coordination claims.
4. Adapt **only** presentation while preserving routes, actor role restrictions, source-backed data, error handling and old actions.
5. Screenshot at 1440×900, 1422×803, 1024×768, 390×844 and 320px, each theme; test reduced motion, high contrast and keyboard.
6. Generate an overlay/difference report against the actual approved owner/Apple reference and record the exact SHA.
7. Have an independent reviewer validate visual and functional acceptance before merge or deployment.

## Evidence categories

`CANDIDATE_PATH_VERIFIED_ONLY`: file exists, no actual component ownership or ready-for-edit status asserted.

`MEASUREMENT_PENDING`: Apple Figma/Sketch source layers not inspected, pixel parity unproven.

`NOT_IMPLEMENTED_BY_THIS_REFERENCE_TASK`: no application files have been modified by these docs.

**Important:** applying the Apple reference design wholesale to `frontend/src/App.tsx` would conflict with existing shared-shell/UI work. Use a separate integration task and exclusive claim, not these documentation commits.
