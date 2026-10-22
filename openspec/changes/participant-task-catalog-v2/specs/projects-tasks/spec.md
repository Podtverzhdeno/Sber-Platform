# Projects and Tasks Delta

## ADDED Requirements

### Requirement: Task catalog uses one authoritative projection

The participant task catalog SHALL use one typed, versioned server projection for cards, list, KPI counts and selected-task detail. Identical filters and sorting SHALL produce identical ordered task IDs in cards and list; current view, filters, sort and selected task SHALL survive view switching and restorable navigation.

#### Scenario: AT-01 deterministic ordering

- **WHEN** eligible tasks have match scores 92, 84 and 68
- **THEN** match-desc ordering returns them in that order with correct `total_found`
- **AND** equal scores use a stable documented tie-breaker

#### Scenario: AT-06 cards and list parity

- **WHEN** a participant with active filters and selected task switches cards to list and back
- **THEN** the same ordered IDs, filters and selected task remain
- **AND** no second client-only ranking is applied

#### Scenario: AT-22 direct list link

- **WHEN** a valid URL encodes list view, sorting and task ID
- **THEN** the list opens with that selection
- **AND** an unavailable ID produces a safe fallback without leaking its data

### Requirement: Catalog selection is side-effect free and deeply linkable

Selecting a catalog card or list row SHALL open its permitted detail without applying, awarding or creating assignment state. A stable task identifier SHALL be represented in restorable navigation, and returning SHALL preserve filters and scroll where feasible.

#### Scenario: Participant selects a task

- **WHEN** a card background or keyboard-selectable row is activated
- **THEN** its detail becomes selected and URL/navigation state identifies the task
- **AND** no application, checkpoint, skill or reward mutation occurs

#### Scenario: Bookmark control is activated

- **WHEN** the participant activates bookmark inside a card
- **THEN** bookmark changes idempotently without changing selected task

### Requirement: Task detail explains facts, forecast and next action

The selected-task panel SHALL show permitted customer identity and verification state, brief summary, match explanation, known difficulty/duration/format/team facts, potential skill impact, conditional benefits, plan stages, support model and application-state-specific actions. Unknown values SHALL be omitted or explicitly unknown rather than replaced by demo values.

#### Scenario: AT-03 forecast data is insufficient

- **WHEN** a competency has no permitted verified current value or no approved numeric forecast
- **THEN** the panel presents qualitative development or insufficient-data text
- **AND** it does not show zero or an invented numeric increase

#### Scenario: AT-17 customer is not verified

- **WHEN** the authoritative customer record is unverified
- **THEN** no verified-partner badge is rendered
- **AND** demo status is labelled honestly when running a demo fixture

#### Scenario: AT-19 portfolio publication is forbidden

- **WHEN** the terms prohibit publishing the artifact
- **THEN** portfolio case is not promised as a guaranteed benefit

### Requirement: Stage preview is a plan until assignment

Before an application is accepted and assignment exists, stage preview SHALL show only versioned brief stages, estimated durations and planned/locked semantics. It SHALL NOT show completed checkpoints, factual task progress or create operational stage records. The catalog design SHALL omit the «Итог» block.

#### Scenario: AT-04 unaccepted task preview

- **WHEN** `application_state` is `none` or `submitted`
- **THEN** stage preview contains no completion ticks or task-progress percentage
- **AND** all nodes are visibly described as plan states

#### Scenario: AT-05 assigned task progress

- **WHEN** an assignment has two accepted checkpoints out of five
- **THEN** factual two-of-five progress appears only in the assigned-task/project workspace from server checkpoints
- **AND** the catalog preview remains a representation of the published plan

### Requirement: Participation conditions are complete and versioned

The conditions dialog SHALL load the current permitted brief and terms version and expose deadline/timezone, expected workload, deliverables, prerequisites, selection criteria, support model, IP ownership/confidentiality, portfolio permission and paid/unpaid semantics. These fields are mandatory for a published task: absence SHALL block publication rather than be replaced by demo data. `support=none`, `unpaid` and restricted/conditional portfolio permission SHALL be explicit values.

#### Scenario: Customer submits incomplete participation terms

- **WHEN** any mandatory terms field is absent or paid compensation lacks its currency, amount/rule or payout condition
- **THEN** publication is rejected with typed field errors
- **AND** no participant sees a partially invented conditions dialog

#### Scenario: AT-09 keyboard modal flow

- **WHEN** focus is on “Посмотреть условия” and the participant opens then closes the dialog by keyboard
- **THEN** focus is trapped while modal, Escape closes it and focus returns to the trigger

#### Scenario: Participant zooms the dialog

- **WHEN** content is viewed at 200% zoom or in a short viewport
- **THEN** all conditions and footer actions remain reachable without page-level clipping

### Requirement: Application submission revalidates eligibility and consent

The server SHALL revalidate visibility, publication, role/program, deadline, quota, prerequisites and current terms version when applying. The command SHALL use CSRF/session protection and an idempotency key and SHALL create at most one application for the participant-task pair.

#### Scenario: AT-10 terms change while dialog is open

- **WHEN** a participant accepted version 3 locally but version 4 is current at submit time
- **THEN** the server rejects with typed `TERMS_CHANGED`
- **AND** the UI presents the new version for explicit review without creating an application

#### Scenario: AT-11 rapid repeated submit

- **WHEN** two equivalent apply requests are submitted rapidly
- **THEN** exactly one application exists and the UI converges on its current state

#### Scenario: AT-12 deadline has passed

- **WHEN** the authoritative deadline is in the past for its timezone
- **THEN** a new application is rejected and the refreshed catalog shows an honest unavailable state

### Requirement: Application and catalog states remain truthful

The catalog SHALL adapt actions for `none`, `submitted`, `under_review`, `accepted`, `assigned`, closed and unavailable states. A submitted application SHALL NOT imply team membership or workspace access; accepted/assigned SHALL link to the canonical existing workspace.

#### Scenario: Application succeeds

- **WHEN** the server creates an application
- **THEN** the UI shows “Заявка отправлена”, offers the canonical application/my-tasks route and does not fabricate assignment progress

#### Scenario: Application fails

- **WHEN** persistence or validation fails
- **THEN** no local success state or duplicate item is retained
- **AND** a safe retry or resolution action is shown

### Requirement: Catalog survives partial and offline failures

Catalog, selected detail and conditions dialog SHALL each provide scoped loading, empty, error, forbidden, offline and stale states. Failure of an optional AI service SHALL NOT prevent manual search, filtering, detail review and application.

#### Scenario: AT-07 no search results

- **WHEN** current filters match no task
- **THEN** a meaningful empty state and reset-filters action appear
- **AND** no urgency or fake recommendation is shown

#### Scenario: AT-16 AI disabled

- **WHEN** all AI feature flags are disabled
- **THEN** search, filters, selection, conditions and application remain functional
- **AND** the flow does not call an AI provider

### Requirement: Private tasks and briefs are object-authorized

Catalog, detail, terms, bookmark and share operations SHALL enforce object-level visibility. A denied or removed task SHALL return a safe not-found response and SHALL NOT expose its title, customer contacts, brief, artifacts or private identifiers in payload, DOM, logs or analytics.

#### Scenario: AT-08 foreign private task URL

- **WHEN** an unauthorized participant requests a closed or private task ID directly
- **THEN** the system returns a safe 404-equivalent response
- **AND** no private task fields are disclosed

