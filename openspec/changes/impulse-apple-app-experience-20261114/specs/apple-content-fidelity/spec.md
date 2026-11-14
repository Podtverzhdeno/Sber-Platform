# Capability: apple-content-fidelity

## ADDED Requirements

### Requirement: Every screen presents a decision-oriented content hierarchy
The UI SHALL render the authorized current object/role, an actionable next step only if backed by current server state, and any P0 deadline/payment/consent/review blocker before optional analysis or historical tools. Every server navigation destination (49 across six roles) SHALL be mapped to a detailed per-section content blueprint and preserve the 42 action families.

#### Scenario: A participant opens the main screen with an assigned task
- **WHEN** a participant has a valid actionable assigned task and a course also available
- **THEN** the first fold SHALL show the assigned task as the immediate action, with source title and correct route, while course and other tools remain accessible without changing the participant's active AI role

#### Scenario: Several urgent issues exist
- **WHEN** the server returns more than one important blocked or user-actionable item
- **THEN** the UI SHALL show one real primary action and a named visible "Требует внимания" list, and SHALL NOT bury urgent issues inside a multi-level More menu

#### Scenario: No action is eligible
- **WHEN** every assigned task is pending human review or dispute and no actionable course/role transition is available
- **THEN** the UI SHALL show a truthful read-only status, SHALL NOT invent "Отправить", and SHALL provide only permitted status/detail/trajectory navigation

### Requirement: Secondary features remain discoverable without clutter
The UI SHALL reveal filters, saved views, history, supporting evidence and rare commands through one clearly named disclosure/local tab/inspector tied to current context. Existing authorized destinations and actions SHALL remain reachable; visual grouping SHALL NOT reindex `/workspace/:index` or alter role permissions.

#### Scenario: User needs an advanced task filter
- **WHEN** a user opens `Задачи` and chooses `Фильтры`
- **THEN** all previously implemented filter dimensions and clear/reset behavior SHALL be accessible without losing selected task, role context or query URL

#### Scenario: A reviewer inspects evidence
- **WHEN** a mentor or customer selects work awaiting review
- **THEN** evidence, current version, important criteria, deadline and allowed human decision SHALL be available adjacent to the selected item; a row click SHALL NOT automatically accept work

### Requirement: Data status and microcopy are precise
The UI SHALL use direct Russian action labels, descriptive empty/error text, server-acknowledged saved/sent status and separately labeled reported/verified/credited/revoked/pending states. Unknown or partial data SHALL NOT appear as a genuine zero, "completed" or success.

#### Scenario: Learning program is unpublished
- **WHEN** backend has no published next-level course denominator
- **THEN** the progress view SHALL display a brief publication/unavailable explanation and an authorized fallback instead of a 0/0 progress bar or invented lesson title

#### Scenario: Candidate revokes visibility
- **WHEN** a consented participant becomes no longer HR/public-visible
- **THEN** HR, customer, manager and rating views SHALL NOT continue to expose private cached candidate information through list/inspector/search previews

#### Scenario: Upload or draft is not saved
- **WHEN** a file upload or form submission is still pending, has failed or is offline
- **THEN** the interface SHALL indicate the actual state and SHALL NOT render `Сохранено`, `Доставлено` or `Подтверждено` before the corresponding authorized backend acknowledgment

### Requirement: User-supplied visual sources have explicit provenance
The design SHALL distinguish the user's **four original screenshot uploads** from earlier assistant-generated Impulse mockups and from official Apple/product references. Exact original source dimensions, hashes and traits SHALL be recorded; pixel target claims SHALL be tied to the correct picture type.

#### Scenario: Engineer evaluates user-provided controls
- **WHEN** the reference is the user's 1000×750 neumorphic control kit
- **THEN** the engineer MAY extract control softness, switch and progress track behavior, but SHALL NOT claim the image specifies a 245px desktop app sidebar or a 938px home card

#### Scenario: Comparing a generated assistant concept
- **WHEN** a reviewer uses the old 1440×900 Impulse homepage mockup archive
- **THEN** its geometry SHALL be labeled as an **assistant proposal**, not as one of the user's four uploaded original references or an official Apple screenshot

### Requirement: Light and dark styling preserve usability and semantic contrast
Light and dark versions SHALL use independent accessible token sets with no full-layer faux-neumorphic shadow around every row or glass material behind persistent critical data. Each important control SHALL remain discernible at >=44px touch target and at 200% zoom, keyboard focus visible.

#### Scenario: White button contrast
- **WHEN** a white label is used on a filled light-theme blue primary button
- **THEN** the chosen final fill SHALL meet normal text contrast >=4.5:1; the illustrative `#007AFF` with white (approximately 4.02:1) SHALL NOT be accepted as normal-sized text without a contrast adjustment

#### Scenario: Dark review form
- **WHEN** a mentor or operator opens evidence and decision controls under dark theme
- **THEN** body text, critical warning, input and focus indicators SHALL remain legible and decisions SHALL remain explicit human actions without hidden/overlaid information

### Requirement: Content architecture is independently tested before whole-app rollout
Each of the 49 route designs SHALL have a reviewed first-fold, one expanded secondary state, one object detail and loading/empty/error/blocked state, plus keyboard, mobile and role authorization checks; all action groups A01–A42 SHALL be independently verified. Product owner reference agreement and integration exact-SHA checks SHALL be required before production promotion.

#### Scenario: Visual polish passes but existing function disappears
- **WHEN** a screen looks like the approved white screenshot but a previously authorized project upload, chat attachment, consent change or advanced task filter is no longer reachable
- **THEN** the screen migration SHALL fail acceptance even if color and geometry match

#### Scenario: Code is not deployed
- **WHEN** only SDD files change in GitHub
- **THEN** the change SHALL be described as a design deliverable; production, live browser behavior and business functionality SHALL NOT be claimed updated
