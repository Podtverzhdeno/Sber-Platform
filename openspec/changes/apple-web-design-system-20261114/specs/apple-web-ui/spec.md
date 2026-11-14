# Apple-inspired Web UI — capability requirements

## ADDED Requirements

### Requirement: Theme and semantic design tokens
Impulse SHALL provide consistent light/dark theme tokens for app background, sidebar, content surface, elevated panels, text, borders, selection, accent, state colors, radii, spacing and shadows; existing theme preference and system fallback SHALL keep working.

#### Scenario: Explicit light or dark selection
- **WHEN** a user switches theme
- **THEN** all shared shell and controls retain readable contrast without inverting content imagery

#### Scenario: System appearance selection
- **WHEN** the operating system changes appearance and the user selected system
- **THEN** the resolved theme follows it

#### Scenario: Preference persists
- **WHEN** the user reloads the interface
- **THEN** their explicitly stored preference is preserved

### Requirement: Native-feeling typography
All common screens SHALL use the system UI font stack, clear title/subtitle/body hierarchy, compact metadata, tabular numerals and strong Cyrillic readability; protected SF font binaries SHALL NOT be bundled.

#### Scenario: Windows browser
- **WHEN** the site runs on Windows
- **THEN** platform-native font fallback renders legibly

#### Scenario: Apple operating system
- **WHEN** the site runs on a compatible Apple OS
- **THEN** system UI typography is selected

### Requirement: Shared control parity
Buttons, icon controls, inputs, selects, checkboxes, segmented controls, tabs, badges and links SHALL share consistent size, corners, hover, active, focus, disabled and error states. Primary actions SHALL remain visually distinguishable.

#### Scenario: Keyboard focus
- **WHEN** a button gains keyboard focus
- **THEN** its focus outline is visibly distinguishable

#### Scenario: Disabled action
- **WHEN** a button is disabled
- **THEN** it cannot be mistaken for active and its existing disabled behavior stays unchanged

#### Scenario: Destructive operation
- **WHEN** an alert is destructive
- **THEN** its destructive semantics remain evident and it is never converted to primary blue

### Requirement: Layout and navigational stability
Sidebar, toolbar, global search, responsive mobile menu, notification overlay and role switcher SHALL preserve existing targets and roles while reducing decorative noise.

#### Scenario: Mobile viewport
- **WHEN** viewport is 390×844
- **THEN** content has no page-level horizontal scroll and controls remain operable

#### Scenario: Keyboard navigation
- **WHEN** keyboard Tab traverses navigation
- **THEN** current page state and focus remain visible

#### Scenario: Authorized role navigation
- **WHEN** users switch roles
- **THEN** only their authorized navigation is rendered

### Requirement: Consistent content surfaces
Cards, metrics, tables, dialogs, drawers, empty/loading/error states and content sections SHALL adopt semantic surfaces and restrained borders in both themes; readability SHALL take priority over glass effects.

#### Scenario: Error state
- **WHEN** a state panel reports an error
- **THEN** its message and available retry action remain visible

#### Scenario: Data table overflow
- **WHEN** a data table overflows
- **THEN** its horizontal scroll container remains accessible

#### Scenario: Dialog focus management
- **WHEN** a dialog opens
- **THEN** Escape, focus trapping and focus restoration continue to work

### Requirement: All role routes covered
Participant, mentor, customer, manager, HR and operator SHALL each be included in the screen-level acceptance matrix, including all role-specific subpages.

#### Scenario: Secondary functionality
- **WHEN** a section is infrequently used
- **THEN** its underlying controls are moved into contextual hierarchy rather than removed

#### Scenario: Unreviewed visual composition
- **WHEN** any screenshot gate is not accepted
- **THEN** the change cannot be called pixel-perfect or fully shipped

### Requirement: Verifiable non-regression
The migration SHALL pass component/type/lint/build checks and major role journeys plus light/dark desktop/tablet/mobile screenshot review before mainline rollout.

#### Scenario: Intentional screenshot change
- **WHEN** legacy screenshot baselines intentionally change
- **THEN** baseline updates require manual review, not blanket acceptance

#### Scenario: Broken user workflow
- **WHEN** a workflow breaks
- **THEN** restore workflow behavior before visual release
