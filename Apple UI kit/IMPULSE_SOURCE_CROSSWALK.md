# Impulse source crosswalk — Apple UI reference library

Read-only audit from GitHub main revision e81c16f680260d6d5137b3426937930bbcfaa5d6 (15 Nov 2026). This file is not an Apple asset and does not modify the app.

Exact current file and test Git blob SHA values are in [the JSON crosswalk](IMPULSE_SOURCE_CROSSWALK.json). These SHAs are **Impulse code file hashes, not hashes of official Apple design frames**.

| Source area | Apple reference | Impulse production file | Existing test | Protected behavior |
|---|---|---|---|---|
| Navigation drawer | [02-navigation-sidebars-tabs](02-navigation-sidebars-tabs/README.md) | `frontend/src/features/calm-navigation/Sidebar.tsx` | `frontend/src/features/calm-navigation/Sidebar.test.tsx` | role routing and access |
| Overlay geometry | [02-navigation-sidebars-tabs](02-navigation-sidebars-tabs/README.md) | `frontend/src/app/overlay-navigation.scss` | `frontend/src/app/screen-layout.test.ts` | hidden-at-rest drawer owner contract |
| Shared controls/dialogs | [03-buttons-and-selection](03-buttons-and-selection/README.md) | `frontend/src/components/ui.tsx` | `frontend/src/components/ui.test.tsx` | focus + actions |
| Apple UI surfaces | [06-lists-tables-cards](06-lists-tables-cards/README.md) | `frontend/src/features/apple-surface/AppleSurface.tsx` | `frontend/src/features/apple-surface/AppleSurface.test.tsx` | content hierarchy |
| Apple web tokens | [01-liquid-glass-materials](01-liquid-glass-materials/README.md) | `frontend/src/app/apple-web-ui.scss` | Not asserted | content vs control material |
| Theme selector | [08-typography-colors-symbols](08-typography-colors-symbols/README.md) | `frontend/src/app/theme-controls/ThemeControl.tsx` | `frontend/src/app/theme-controls/ThemeControl.test.tsx` | light/dark/system |
| Theme persistence | [11-motion-accessibility-responsive](11-motion-accessibility-responsive/README.md) | `frontend/src/app/theme.ts` | `frontend/src/app/theme.test.ts` | system + persisted choice |
| Bootcamp search | [04-forms-and-inputs](04-forms-and-inputs/README.md) | `frontend/src/features/bootcamp/catalog.tsx` | `frontend/src/features/bootcamp/catalog.test.tsx` | real query states |
| Bootcamp learning | [06-lists-tables-cards](06-lists-tables-cards/README.md) | `frontend/src/features/bootcamp/learning-content/CourseLearningContent.tsx` | `frontend/src/features/bootcamp/learning-content/course-learning.test.tsx` | course progress source |
| Customer task wizard | [04-forms-and-inputs](04-forms-and-inputs/README.md) | `frontend/src/features/customer-create-task.tsx` | `frontend/src/features/customer-create-task.test.tsx` | terms + publish |
| Chat compose | [07-messages-collaboration](07-messages-collaboration/README.md) | `frontend/src/features/messenger/composer.tsx` | `frontend/src/features/messenger/composer.test.tsx` | draft/send state |
| Chat history | [07-messages-collaboration](07-messages-collaboration/README.md) | `frontend/src/features/messenger/chat-history.tsx` | `frontend/src/features/messenger/chat-history.test.tsx` | message identity |
| Chat attachments | [07-messages-collaboration](07-messages-collaboration/README.md) | `frontend/src/features/messenger/attachment-card.tsx` | `frontend/src/features/messenger/attachment-card.test.tsx` | source-linked attachments |
| Collaboration | [07-messages-collaboration](07-messages-collaboration/README.md) | `frontend/src/features/collaboration.tsx` | `frontend/src/features/collaboration.test.tsx` | permissions |
| Mentor review | [05-menus-popovers-sheets](05-menus-popovers-sheets/README.md) | `frontend/src/features/mentor.tsx` | `frontend/src/features/mentor.test.tsx` | human review |
| Customer candidates | [06-lists-tables-cards](06-lists-tables-cards/README.md) | `frontend/src/features/customer-candidates.tsx` | `frontend/src/features/customer-candidates.test.tsx` | authorized candidates |
| HR pipeline | [06-lists-tables-cards](06-lists-tables-cards/README.md) | `frontend/src/features/hr.tsx` | Not asserted | consent + human decisions |
| Operator cases | [09-progress-feedback-states](09-progress-feedback-states/README.md) | `frontend/src/features/operator.tsx` | Not asserted | case status + origin |
| Manager metrics | [09-progress-feedback-states](09-progress-feedback-states/README.md) | `frontend/src/features/manager.tsx` | Not asserted | no fake aggregates |
| Portfolio | [10-portfolio-wallet-identity](10-portfolio-wallet-identity/README.md) | `frontend/src/features/portfolio-v2.tsx` | Not asserted | verified vs reported |
| Analytics charts | [06-lists-tables-cards](06-lists-tables-cards/README.md) | `frontend/src/features/analytics-reference.tsx` | `frontend/src/features/analytics-reference.test.tsx` | trusted series |

## Handoff for implementers

1. Reverify file existence and blob SHA in current main before editing; this snapshot becomes stale as the app evolves.
2. Obtain licensed official Apple 27 Figma/Sketch frame, exact ID, variant/state and measurements before claiming pixel parity.
3. Open a distinct exclusive integration claim. Do not reuse this source-library claim for frontend changes.
4. Preserve Impulse role permissions, API values, human approval/consent, navigation and theme persistence.
5. Run corresponding unit test, browser keyboard/touch checks and source/owner screenshot diff at matching viewport and DPR.

**Limit:** web CSS backdrop-filter is not Apple's native Liquid Glass renderer. These links identify implementation targets, not 1:1 source pixel measurements.
