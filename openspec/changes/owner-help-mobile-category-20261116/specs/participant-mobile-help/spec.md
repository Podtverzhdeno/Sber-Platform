# Participant mobile help navigation

## ADDED Requirements

### Requirement: Mobile help SHALL expose every category without horizontal scrolling
At viewports of 600 CSS pixels or less, the authorized help library SHALL expose a single labeled native category selector, including each permitted category, a contextual category where applicable, and the all-topics choice. The desktop category sidebar SHALL remain available above 600 CSS pixels.

#### Scenario: Participant switches category on a narrow device
- **WHEN** an authorized participant opens help at 320 or 390 CSS pixels and changes the category
- **THEN** all permitted options are reachable via keyboard and touch, the visible topics use the existing category filter, and the search query and selected topic reset

### Requirement: Help controls SHALL remain legible and reachable on small screens
The mobile help search SHALL use an input font size of at least 16 CSS pixels and primary close, back, and action controls SHALL provide at least 44-by-44 CSS pixel hit areas. Help content SHALL fit 320, 390, and 768 CSS pixel viewports without document-level horizontal overflow.

#### Scenario: Participant searches and returns to help
- **WHEN** a participant uses search, opens a topic, and returns to categories on a 320 CSS pixel screen
- **THEN** the search remains legible, navigation remains operable without zoom or page-level horizontal scrolling, and focus stays within the help dialog while it is open

### Requirement: Help redesign SHALL preserve permissions and nonvisual behavior
The help interface SHALL retain authorized topic filtering, instructional links, onboarding, overlay close and keyboard focus behavior across light, blue, and midnight themes, reduced motion, and forced-colors mode.

#### Scenario: Restricted participant opens the help dialog
- **WHEN** a participant without a privileged navigation permission opens mobile help
- **THEN** inaccessible topic links stay hidden, their original URLs are not broadened, and the native selector remains usable
