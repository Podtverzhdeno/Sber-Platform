# Capability: apple-role-screen-contracts

## ADDED Requirements

### Requirement: Every server-permitted role destination has a screen-level L0/L1/L2 contract
The redesign SHALL cover all **49 destination entries** of the six roles in current `ROLE_NAVIGATION`: 13 participant, 8 mentor, 6 customer, 8 manager, 5 HR, 9 operator. Each SHALL declare first-fold purpose/status/action (L0), reachable secondary functions (L1), and detailed evidence/actions (L2), without deleting existing functionality.

#### Scenario: Participant development and practice
- **WHEN** an authorized participant navigates Home → Trajectory → Bootcamp → Task → Project
- **THEN** the UI SHALL preserve the exact active role, source course/task/project identity, L0–L3 requirements, learning/practice evidence and deep link across every new presentation

#### Scenario: Customer demo differs from server navigation
- **WHEN** customer is in demo-specific `mockCustomer` mode
- **THEN** its existing extra creation/applications/assistant/participants/settings destinations MAY be shown under the same demo condition, but SHALL NOT be invented as authorization in the ordinary six-destination customer navigation

### Requirement: Work-related and consequential screens keep critical context visible
For all roles, current object title, urgent status, deadline, financial terms, verification state, blocking permission, required human decision and reason for disabled controls SHALL remain L0 or directly adjacent to the action; they SHALL NOT be buried behind `Ещё`.

#### Scenario: Mentor evidence review
- **WHEN** a mentor selects a contribution requiring acceptance
- **THEN** the evidence, authored version and conflict-of-interest status SHALL be visible next to review action before the user can publish a human decision

#### Scenario: Operator dispute or payout
- **WHEN** an operator opens blocked work, a dispute or a payment case
- **THEN** the blocking reason, current version and audit context SHALL be visible without guessing; no financial mutation may occur from merely selecting a row

### Requirement: Incomplete AS-IS routes are represented honestly
If existing `RoleDashboard` or `ManagerVisualPage`/`OperatorVisualPage` exposes a demonstration-only or placeholder action, the design SHALL mark the control as a demo or unavailable and SHALL NOT claim the UI redesign implemented a missing backend flow.

#### Scenario: Manager opens team calendar unsupported by live API
- **WHEN** the destination exists but no authoritative event/meeting data API is available
- **THEN** the page SHALL show an honest unavailable state and any existing demo behavior with correct marking rather than fabricated meetings

### Requirement: Source-to-destination mapping stays auditable
Every design screen SHALL reference the current renderer and authorized source label and SHALL have tests for reachability, deep links and exact role context.

#### Scenario: Future redesign review
- **WHEN** a reviewer inspects a proposed screen migration
- **THEN** they can map its L0/L1/L2 rows to the `source-route-inventory.md` entry and compare current vs proposed actions
