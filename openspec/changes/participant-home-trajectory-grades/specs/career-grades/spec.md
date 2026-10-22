# Career Grades Specification

## ADDED Requirements

### Requirement: Career grade uses a separate versioned domain model

The system SHALL represent a participant career grade separately from competency level, roadmap stage progress, readiness percentage, rating/XP and result review grade A/B/C. Each career-grade catalog SHALL be scoped to a role or trajectory, versioned, effective-dated and attributable to an approved policy source.

#### Scenario: The API returns development status

- **WHEN** an authorized participant requests a development overview
- **THEN** the response identifies `career_grade`, `competency_level`, `stage_progress`, `readiness_percent`, `rating_xp` and `review_grade` as independent concepts
- **AND** it includes the grade catalog/calculation version and `as_of` timestamp

#### Scenario: No approved catalog exists

- **WHEN** a role has no published career-grade policy
- **THEN** the system reports the grade as not evaluable or provisional
- **AND** it MUST NOT infer an official grade from UI constants, XP, stage progress or review grade

### Requirement: Grade readiness is explainable and evidence-backed

The system SHALL calculate readiness from one versioned rule set and authorized evidence records. Completed and remaining percentages SHALL be complementary views of the same normalized metric, and the UI SHALL expose the requirements, contribution, evidence state and calculation timestamp.

#### Scenario: Readiness is displayed

- **WHEN** the participant opens a grade summary or target-grade detail
- **THEN** completed percentage plus remaining percentage equals 100 within documented rounding rules
- **AND** each material contribution links to its requirement and evidence status

#### Scenario: Evidence is pending or stale

- **WHEN** a required evidence item is pending review, revoked or outside its freshness policy
- **THEN** the readiness explanation shows that state
- **AND** the evidence MUST NOT be counted as verified readiness unless the versioned policy explicitly allows it

### Requirement: Career-grade transitions are automatic, server-authoritative and auditable

When readiness reaches 100% under an active published policy, the system SHALL automatically grant the next permitted career-grade transition. The server SHALL recompute eligibility from authorized verified evidence, persist previous/new grade, policy and calculation versions, evidence references, calculation fingerprint, timestamp and a system actor, and emit an immutable audit event. Client state or a client transition command SHALL NOT grant a grade.

#### Scenario: Readiness reaches 100%

- **WHEN** all computed requirements are satisfied
- **THEN** the server atomically grants the next policy-permitted grade without human confirmation
- **AND** retrying the same calculation fingerprint does not create a second transition

#### Scenario: Unauthorized client attempts to grant a grade

- **WHEN** a participant or client submits a direct grade transition command or forged readiness
- **THEN** the server rejects it regardless of client permission flags
- **AND** no grade history is changed

#### Scenario: Evidence is revoked after an automatic transition

- **WHEN** evidence used by an already recorded transition is later revoked or becomes stale
- **THEN** the historical transition remains immutable and auditable
- **AND** the current projection identifies the affected state without silently auto-demoting the participant

#### Scenario: No published policy exists

- **WHEN** readiness-like UI data reaches 100% but the role has no active published grade policy
- **THEN** no automatic transition occurs
- **AND** the grade remains provisional or not evaluable

### Requirement: Grade history is durable and version-aware

The system SHALL retain current, completed, target and locked/not-evaluable grade states with policy version, effective timestamps and transition history. Recalculation under a new policy SHALL preserve prior decisions and explain any new projection.

#### Scenario: Policy version changes

- **WHEN** a new catalog or calculation policy becomes effective
- **THEN** existing confirmed transitions remain auditable against their original version
- **AND** a new projected readiness identifies the new version without rewriting history

### Requirement: Multiple trajectories remain isolated

The system SHALL calculate career-grade readiness independently for each active role or trajectory. Shared evidence MAY contribute to more than one trajectory only through an explicit versioned mapping.

#### Scenario: Participant switches active role

- **WHEN** the participant selects another active role
- **THEN** grade, requirements, stage progress and next action are loaded for that role
- **AND** values from the previously selected role are not displayed as the new role's values

### Requirement: Grade data enforces object-level access control

The system SHALL authorize grade catalog, projection, evidence detail and transition history per subject and object. Client-side visibility controls SHALL NOT substitute for server authorization.

#### Scenario: A participant requests another person's grade detail

- **WHEN** the requester lacks explicit permission for that participant and trajectory
- **THEN** the server denies the request without exposing requirements, evidence or history

