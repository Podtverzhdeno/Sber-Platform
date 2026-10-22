# Career Roadmap Delta

## ADDED Requirements

### Requirement: Trajectory v2 uses an interactive role master-detail model

The trajectory workspace SHALL show selectable role cards and a detail area for the selected role. Roles SHALL distinguish primary, active, paused and unselected states. Unselected roles SHALL NOT display fabricated personal progress.

#### Scenario: Participant switches role

- **WHEN** the participant selects an accessible role card
- **THEN** the stage map, grade summary, next step and Skill Passport context update atomically for that role
- **AND** the selected state is keyboard-visible and represented in the URL or equivalent restorable navigation state

#### Scenario: Participant opens an unselected role

- **WHEN** a role is available for exploration but not selected as a trajectory
- **THEN** the UI presents role information and an explicit selection action
- **AND** personal stage/grade values are omitted or clearly marked not applicable

### Requirement: Role path exposes stages, tasks and lock reasons

The selected role SHALL present an ordered path of stages with completed, current, available and locked states. Selecting a stage SHALL reveal its tasks, rewards/impact, evidence requirements and progress. The number of stages SHALL come from the versioned roadmap rather than a hard-coded prototype count.

#### Scenario: Participant selects a current stage

- **WHEN** the participant activates a stage
- **THEN** the task list and progress for that stage become visible
- **AND** stage progress remains distinct from career-grade readiness and overall trajectory mastery

#### Scenario: Participant selects a locked stage

- **WHEN** the participant activates a locked stage
- **THEN** the UI explains prerequisites and the first permitted action
- **AND** it does not expose an action that the server will reject without explanation

### Requirement: Task and evidence detail is available without losing context

A task/evidence drawer SHALL show status, purpose, requirements, expected artifact, verification state, impact and canonical continuation action. Closing it SHALL restore focus to the initiating task and preserve selected role/stage.

#### Scenario: Completed task is opened

- **WHEN** the participant opens a completed task
- **THEN** the drawer shows the verified evidence and verification metadata allowed by policy
- **AND** the primary action opens the canonical result/evidence view rather than restarting the task

### Requirement: Role information is structured and source-backed

The role-information dialog SHALL provide six clearly named content sections covering role purpose, responsibilities, competencies, representative tasks, development/grade expectations and entry/transition requirements. Content SHALL identify its catalog version and SHALL not be sourced from arbitrary client text.

#### Scenario: Role information opens

- **WHEN** the participant opens role information
- **THEN** the first section is focused, tabs are keyboard-operable and the active section is announced
- **AND** the content corresponds to the selected role version

### Requirement: Context actions have explicit semantics

The trajectory menu SHALL support compare role, pin/unpin, share where permitted, hide/show unselected roles and configure path. Each action SHALL either complete with visible feedback or explain why it is unavailable; no menu item may be inert.

#### Scenario: Participant compares roles

- **WHEN** the participant selects compare and chooses an eligible role
- **THEN** the UI compares requirements, verified progress and next actions using the same metric definitions
- **AND** does not collapse different role-specific grade policies into one score

#### Scenario: Participant shares a trajectory

- **WHEN** authenticated internal sharing is permitted and activated
- **THEN** the system creates a recipient-scoped, expiring and revocable link containing only the approved allowlist
- **AND** anonymous public access, raw evidence/URLs, comments, contacts, closed projects, messages, compensation, documents and internal identifiers are excluded

### Requirement: All-grades view shares the canonical grade catalog

The all-grades dialog in the trajectory SHALL use the same catalog, current/target states and readiness source as the home grade panel. It SHALL show reached, current, target and future states with accessible text in addition to color.

#### Scenario: All-grades dialog opens from trajectory

- **WHEN** the participant activates the grade summary
- **THEN** the dialog displays the role-scoped ordered grade catalog and current projection
- **AND** values match the home view for the same snapshot/version

