# Pixel dashboard live connection requirements

## ADDED Requirements

### Requirement: Verified production data only
The pixel dashboard SHALL obtain module, role level, course progress and confirmed skills from the existing authenticated APIs and SHALL not replace failed fetches with invented success counts.

#### Scenario: Level request missing
- **WHEN** a role-level API projection is unavailable
- **THEN** the UI indicates unknown level and does not infer L0 or a completion percentage

### Requirement: Course progress matches current target
Course lesson progress SHALL only appear when the actionable target is a course and the learning-summary result contains the matching `course_key`.

#### Scenario: Task is actionable
- **WHEN** the user has an actionable task and a suggested course
- **THEN** the task wins as the main CTA and the unrelated course's lesson progress is not shown

### Requirement: No unauthorized feature links
Tools and profile callbacks SHALL be supplied by the authenticated App integration owner. The dashboard SHALL never fabricate an available AI Buddy link or replace its tools callback with an unrelated route.

#### Scenario: AI Buddy disabled
- **WHEN** the actor lacks AI Buddy access
- **THEN** the interface displays the regular permitted tools without the AI Buddy claim

### Requirement: Three explicitly identifiable themes
The pixel dashboard SHALL maintain three persistent modes (sun light, blue moon, dark moon), cycle only among these modes and synchronize with legacy light/dark CSS variables while preserving saved explicit user choices.

#### Scenario: Theme clicked three times
- **WHEN** the user clicks the single compact theme control three times from light
- **THEN** the UI displays blue, then midnight, then light again, with corresponding iconography

### Requirement: Safe shared integration
The isolated live connector SHALL NOT modify App, theme-control, role navigation, or participant-home sources while another active claim owns those files.

#### Scenario: Active App claim
- **WHEN** the App integration claim is IN_PROGRESS
- **THEN** this task delivers tested source bindings but cannot claim the new screen is mounted or production-ready
