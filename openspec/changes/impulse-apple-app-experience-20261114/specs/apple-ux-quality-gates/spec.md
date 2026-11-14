# Capability: apple-ux-quality-gates

## ADDED Requirements

### Requirement: Every migrated screen passes parity and accessibility before replacement
Every role×screen migration SHALL pass the accepted AS-IS functionality inventory, route/permission negative tests, 320/390/768/1024/1440 viewport checks, keyboard/assistive technology, theme, 200% zoom, reduced motion and error/offline states. A reviewer other than the author SHALL inspect screenshots and behavior on the exact proposed commit before marking its task DONE.

#### Scenario: Responsive candidate view
- **WHEN** HR opens an authorized candidate detail on a 390px screen
- **THEN** the identity, evidence, consent and next stage action remain readable and accessible; no private field is exposed via shared screen/preview

#### Scenario: Visual-only test passes, parity fails
- **WHEN** screenshots match design but a previously available task filter or message attachment action is missing
- **THEN** the migration SHALL remain NOT ACCEPTED even if appearance looks correct

### Requirement: CI gates are exact-revision and honest
The integration reviewer SHALL run frontend TypeScript, lint, component tests, route E2E, browser screenshot comparisons and relevant backend/API/authorization checks on one exact SHA. Any failure or missing browser verification SHALL be recorded as FAIL/UNKNOWN; no green claim from a Docker build alone.

#### Scenario: Unrelated backend baseline is red
- **WHEN** a migration's UI checks pass but baseline backend tests or vulnerability scan fails
- **THEN** the release report SHALL distinguish independently failing gates and not silently suppress them; release owner SHALL make an explicit go/no-go decision

### Requirement: Release is staged and rollback-safe
Implementation SHALL proceed in independent waves by role/section without replacing the entire app in one commit. `main` merge and Railway deployment SHALL require explicit release authority and a verified rollback path; old screens shall remain accessible during transition where safe.

#### Scenario: New home accepted but mentor screen not accepted
- **WHEN** participant Home passes independent review and mentor Home has not passed
- **THEN** only participant Home may be enabled under the approved rollout; all other roles keep their existing behavior and routes

#### Scenario: Production does not match review SHA
- **WHEN** the Railway source SHA differs from the reviewed integration SHA
- **THEN** the deployment SHALL not be described as reviewed, and the team SHALL verify/restore an approved exact build before broader rollout
