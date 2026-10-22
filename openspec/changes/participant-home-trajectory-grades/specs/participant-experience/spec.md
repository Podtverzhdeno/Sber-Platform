# Participant Experience Delta

## ADDED Requirements

### Requirement: Participant home v2 prioritizes the next verified outcome

The participant home SHALL present a compact development workspace whose first content row combines the next verified outcome, current career-grade summary and weekly focus. The next actionable step SHALL appear immediately above active tasks, with compact AI Buddy and Skill Passport context in the supporting rail. A separate greeting card or large generic motivation banner SHALL NOT displace these actionable blocks; identity MAY remain in the application top bar.

#### Scenario: Home loads successfully

- **WHEN** the participant opens the home route
- **THEN** the primary viewport explains what to do next, why it matters, which skill/grade requirement it affects and where the action leads
- **AND** current grade, weekly focus, active tasks, Buddy and Skill Passport use the same authorized snapshot

#### Scenario: Next outcome is also an active task

- **WHEN** the same task is selected as the next outcome and is present in active tasks
- **THEN** the UI keeps one canonical task identity and consistent state
- **AND** it avoids contradictory titles, progress or destinations

### Requirement: Home data is real, fresh and independently resilient

The home SHALL use API-backed participant data with `as_of` and calculation/source metadata. Demo constants SHALL be allowed only in deterministic tests or explicitly labelled prototype mode. Independent panels SHALL expose local loading, empty, unavailable and retry states without blocking the entire route.

#### Scenario: Grade projection fails while tasks load

- **WHEN** the grade projection request fails and active tasks succeed
- **THEN** active tasks and their actions remain usable
- **AND** the grade panel shows a scoped error with retry and no fabricated fallback value

#### Scenario: Cached home is revalidated

- **WHEN** a valid cached snapshot exists
- **THEN** the shell and cached content render immediately with freshness metadata
- **AND** background revalidation does not blank unrelated panels

### Requirement: Weekly focus is navigable and explainable

The participant SHALL be able to select a day in the permitted week range and inspect the associated plan, completed activity and missed items. The UI SHALL distinguish planned work from verified completion.

#### Scenario: Participant selects another day

- **WHEN** a day control is activated by pointer or keyboard
- **THEN** the displayed focus updates for that date
- **AND** the selected state and human-readable date are exposed to assistive technology

### Requirement: Home actions have stable deep links

Every actionable task, next step, grade requirement, Buddy recommendation and Skill Passport item SHALL navigate using stable object identifiers. An unavailable target SHALL yield an explanatory state, not an inert control.

#### Scenario: Participant opens the recommended task

- **WHEN** the participant activates the next-step call to action
- **THEN** the application opens the canonical course, project, checkpoint or evidence destination
- **AND** Back navigation restores the prior home state

### Requirement: Buddy remains user-triggered and grounded

The compact AI Buddy panel SHALL initially offer an explicit recommendation action unless a still-valid user-requested recommendation exists. A generated recommendation SHALL identify allowed source data, calculation time and destination and SHALL NOT silently change grade, progress or task state.

#### Scenario: Participant requests a recommendation

- **WHEN** the participant activates “Получить рекомендацию”
- **THEN** the system analyzes only permitted current progress, tasks, courses and evidence
- **AND** returns an actionable recommendation with rationale, freshness and stable deep link

