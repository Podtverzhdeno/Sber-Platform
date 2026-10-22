# Talent Matching Delta

## ADDED Requirements

### Requirement: Task matching evaluates eligibility before relevance

The task recommendation service SHALL apply hard visibility and eligibility rules before calculating or presenting relevance. A high potential-growth score SHALL NOT conceal a failed prerequisite or make an ineligible task actionable.

#### Scenario: Eligibility and relevance use approved input categories

- **WHEN** the service evaluates a catalog candidate
- **THEN** it first checks publication/visibility, tenant/program, invitation scope, deadline, quota and mandatory prerequisites
- **AND** only an eligible candidate may use verified competency evidence, selected versioned trajectory/role requirements, published task requirements and explicit format/workload preferences for relevance

#### Scenario: AT-20 growth exists but prerequisite fails

- **WHEN** a task could develop a weak competency but the published prerequisite is not met
- **THEN** the service returns the explicit eligibility limitation
- **AND** the UI does not present the participant as eligible based on growth potential

### Requirement: Match score is versioned and explainable

A numeric `match_percent` SHALL include algorithm version, source snapshot version, coverage and permitted reason/factor information. It SHALL mean relevance to the selected trajectory and task requirements, never task completion or probability of acceptance, offer or hiring.

#### Scenario: AT-02 participant opens match explanation

- **WHEN** a numeric score is shown
- **THEN** the participant can inspect permitted contributing reasons and freshness
- **AND** no copy describes the score as likelihood of selection or employment

#### Scenario: Score evidence is insufficient

- **WHEN** coverage is below the approved threshold
- **THEN** the service returns not-calculable or explicitly low-confidence state
- **AND** the UI does not convert the state to zero percent

#### Scenario: Numeric policy is not yet published

- **WHEN** eligibility passes but weights or minimum coverage do not have an approved active version
- **THEN** the service returns qualitative permitted reasons without a numeric score
- **AND** the core catalog, detail and application flow remains available

#### Scenario: AT-18 equal score ordering

- **WHEN** two tasks have equal match score under the same snapshot
- **THEN** the catalog uses the documented deterministic tie-breaker across requests and views

### Requirement: Matching invalidates when role or evidence changes

Cached task match SHALL be keyed by participant, selected role/trajectory, algorithm version and relevant evidence/profile snapshot. A role or qualifying evidence change SHALL invalidate or version-separate stale scores.

#### Scenario: AT-14 participant changes active trajectory

- **WHEN** the participant changes the selected active trajectory
- **THEN** task recommendations and explanations are refreshed for the new role snapshot
- **AND** an old role score is not displayed as current

### Requirement: Skill impact is an explicit non-mutating forecast

Potential skill development SHALL be computed as a separate read-only projection with model/version, calculation status and verification-required marker. It SHALL NOT mutate competency evidence, Skill Passport, career grade, rating or portfolio.

#### Scenario: Numeric forecast is available

- **WHEN** an approved forecast model has sufficient current evidence and task expectations
- **THEN** current and projected values are labelled separately and the projected value is marked as forecast requiring successful verified work

#### Scenario: AT-13 application is submitted

- **WHEN** a participant views, bookmarks or applies to a task
- **THEN** no verified skill, reward, certificate, grade or portfolio evidence is granted

#### Scenario: Revoked evidence changes projection

- **WHEN** evidence used by a match or skill forecast is revoked
- **THEN** the versioned projection is recalculated or marked stale
- **AND** historical verified records are not fabricated or silently rewritten

### Requirement: Match and forecast are accessible

Numeric rings, bars and colors SHALL have equivalent text containing metric name, value/status and meaning.

#### Scenario: AT-21 screen reader reads match

- **WHEN** assistive technology focuses a 92% match indicator
- **THEN** it announces “Соответствие выбранной траектории 92 процента” or equivalent
- **AND** understanding does not require perceiving color

