# Figma iOS 16 controls

## ADDED Requirements

### Requirement: Source-node traceability
Each UI Kit control SHALL retain the Figma component and variant node identifiers used for implementation. Measured geometry, colors and text styles SHALL be recorded without guessing missing variants.

#### Scenario: A component has a measured Figma variant
- **WHEN** an engineer inspects the implemented control
- **THEN** the node identifier and matched measured geometry can be traced to this spec

#### Scenario: A source variant has not been retrieved
- **WHEN** an engineer requests exact pixel parity for an uninspected variant
- **THEN** the system shall label it unverified and not treat its rendered output as source-accurate

### Requirement: Interaction fidelity
The ported Button and TextField SHALL behave as native accessible web controls. Visual transfer SHALL NOT replace action handlers, keyboard focus, disabled states or form semantics with inert Figma frames.

#### Scenario: Button is disabled
- **WHEN** a disabled iOS Button is clicked
- **THEN** its click handler is not executed

#### Scenario: TextField receives user input
- **WHEN** a user types into TextField
- **THEN** the input change event is delivered unchanged to its handler

### Requirement: Shared migration without behavior loss
The source-exact component port SHALL be isolated until integration tests verify every replaced React callsite, all role routes and light/dark screens.

#### Scenario: An unreviewed screen lacks a source counterpart
- **WHEN** its visual design has not yet been compared against the matching Figma node
- **THEN** the screen stays on its existing functional controls and is not claimed pixel-perfect
