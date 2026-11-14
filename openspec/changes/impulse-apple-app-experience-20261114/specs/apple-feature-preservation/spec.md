# Capability: apple-feature-preservation

## ADDED Requirements

### Requirement: Existing actions remain reachable with the same domain contracts
The redesign SHALL preserve every operation in `docs/action-preservation-ledger.md` (A01–A42), including parameters, authorization, lifecycle state, confirmation, audit and error handling. Changing visibility from L0 to L1/L2 SHALL NOT mutate business rules or silently remove accessible features.

#### Scenario: Hide secondary filters
- **WHEN** task catalog's advanced filters move into `Фильтры`
- **THEN** a user can still set/clear all existing filters and selected task/URL context remains stable

#### Scenario: Human review stays human
- **WHEN** a customer or mentor opens work evidence and accepts or requests revision
- **THEN** only the existing authorized explicit command can commit a decision, with reason/rubric/terms version, and no AI draft or default UI selection SHALL silently approve

#### Scenario: Attachments and history
- **WHEN** a user opens messages or project contribution details
- **THEN** permitted files, uploads, replies, message history, personal evidence and retry/error states SHALL remain reachable and functionally equivalent

### Requirement: Critical verification and privacy semantics stay truthful
The interface SHALL distinguish observed vs estimated, started vs completed, reported vs verified, credited practice vs approved work, career grade vs Impulse level, authorized vs public profile, pending/accepted/rejected/revoked statuses. Missing data SHALL be unknown, not a plausible zero.

#### Scenario: Skill passport partial data
- **WHEN** an API response contains unverified skills or errors
- **THEN** the new screen SHALL not count them as confirmed, and SHALL show a clear missing/partial state while preserving the authorized evidence detail path

#### Scenario: Withdraw public visibility
- **WHEN** a participant revokes HR/public consent
- **THEN** the redesigned profile/rating/candidate search SHALL not keep a stale public identity/skill preview outside authorized scope

### Requirement: Deep links and rollback remain stable
Existing route indexes, query parameters, search and notification targets, Back/Forward and classic routes SHALL stay reachable across migration waves, and UI-only feature rollout SHALL be reversible without changing user records.

#### Scenario: Existing shared course link
- **WHEN** someone follows an existing authorized `Bootcamp?course=...&role=...` deep link
- **THEN** the correct course in the correct role SHALL open, regardless of whether the new list view is collapsed

#### Scenario: UI rollback
- **WHEN** the owner disables a presentation rollout flag
- **THEN** the previous screen component SHALL render against the same backend records and authorized routes without data loss
