# Apple-inspired liquid surfaces — capability requirements

## ADDED Requirements

### Requirement: One coherent design system in every role
Every server-authorized workspace SHALL use matching semantic canvas, text, surface, spacing and primary-action styling. UI styling SHALL be based on existing live components rather than replacing working elements with static mockups.

#### Scenario: Participant and HR open their home route
- **WHEN** users open their authorized home sections
- **THEN** both share the same light/dark surface tokens while preserving distinct role content

### Requirement: Full functionality preserved through a presentation update
No redesign SHALL modify route indexes, permissions, mutation handlers, validation, chart values, uploaded documents, messaging or progression state.

#### Scenario: Customer submits a task
- **WHEN** the customer uses the visually updated task-creation flow
- **THEN** the existing required fields, errors, send action and confirmation semantics remain unchanged

### Requirement: Liquid effects only in navigation chrome
Backdrop blur SHALL only decorate navigation or transient chrome, never the reading surface of an information-dense card, and SHALL degrade to an opaque readable surface when transparency is reduced or unsupported.

#### Scenario: Reduced transparency
- **WHEN** browser accessibility preferences disable translucency
- **THEN** topbar and navigation use solid surfaces with visible borders and focus cues

### Requirement: Accessible adaptive views
The design SHALL remain readable in dark/light themes, preserve minimum native focus cues and responsive layouts for narrow screens, and honor reduced-motion/forced-colors settings.

#### Scenario: Operator views queue on mobile
- **WHEN** the viewport is 390px wide
- **THEN** the queue is accessible without global nav column displacement and interactive controls remain keyboard-usable

### Requirement: Design and deployment claims remain auditable
Pixel-perfect equivalence to any reference source SHALL require a matching source-node screenshot and product screenshot, which SHALL NOT be inferred from a token table or CSS-only unit test.

#### Scenario: Unreviewed macOS UI Kit components
- **WHEN** the exact Figma node is unavailable
- **THEN** the implementation is described as source-informed adaptation, not 1:1 reproduction
