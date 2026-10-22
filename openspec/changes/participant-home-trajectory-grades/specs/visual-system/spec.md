# Visual System Delta

## ADDED Requirements

### Requirement: Participant home v2 has stable visual reference states

The visual system SHALL treat the supplied Full UI archive as the reference for information hierarchy and interaction states of participant home v2, grades drawer and target-grade detail. Implementation SHALL use current semantic tokens and component primitives rather than importing the archive's global CSS.

#### Scenario: Desktop visual review runs

- **WHEN** deterministic API-backed fixtures render at approximately 1440–1448 px desktop width
- **THEN** reviewers can compare the dense home, grades drawer and target-grade detail against the registered source states
- **AND** no actionable content is clipped, overlapped or hidden by fixed layers

#### Scenario: Theme changes

- **WHEN** the participant switches between light and dark themes
- **THEN** layout and semantic status meaning remain stable
- **AND** contrast, focus and charts meet the accepted accessibility threshold in both themes

### Requirement: Trajectory v2 has stable responsive reference states

The visual system SHALL treat the supplied Interactive Trajectory archive as the reference for role selection, stage path, right rail, task drawer, role dialog, context menu, all-grades dialog and mobile ordering.

#### Scenario: Mobile trajectory renders

- **WHEN** the route renders at 390 px width
- **THEN** role selection, current stage, next action and grade context remain reachable without horizontal page overflow
- **AND** drawers/dialogs fit the viewport, scroll internally and retain visible close controls

#### Scenario: Intermediate viewport renders

- **WHEN** the route renders near 1024 px width
- **THEN** cards and supporting rail reflow without text collisions
- **AND** interactive targets retain at least the platform minimum hit area

### Requirement: Status is never communicated by color alone

Career grades, roles, stages, tasks and evidence SHALL combine semantic color with label, iconography or text. Motion SHALL respect reduced-motion preferences.

#### Scenario: User cannot distinguish status colors

- **WHEN** color information is unavailable or high-contrast mode is active
- **THEN** completed, current, target, paused and locked states remain distinguishable through text and structure

### Requirement: Overlays use accessible shared behavior

Drawers, dialogs and menus SHALL use shared overlay primitives with focus trap where appropriate, Escape handling, focus restoration, accessible names and deterministic z-index ownership.

#### Scenario: Keyboard user opens and closes an overlay

- **WHEN** an overlay is opened and later closed with keyboard controls
- **THEN** focus remains within the active modal surface while open
- **AND** returns to the initiating control after close

