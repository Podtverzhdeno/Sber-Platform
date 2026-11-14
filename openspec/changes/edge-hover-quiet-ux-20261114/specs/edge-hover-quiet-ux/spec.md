# Edge-hover quiet UX

## ADDED Requirements

### Requirement: Hover navigation discoverability
Desktop users with a fine pointing device SHALL be able to expose navigation by hovering near the left viewport edge, while the application keeps full-width content when closed.

#### Scenario: Pointer enters the activation strip
- **WHEN** a mouse pointer enters the left edge navigation activation strip
- **THEN** the navigation panel appears over the current page, labels smoothly enter and page content width remains unchanged

#### Scenario: Pointer leaves the flyout
- **WHEN** the pointer leaves the panel without keyboard focus inside
- **THEN** the flyout closes and its labels are no longer exposed

### Requirement: Non-modal pointer preview
Hover opening the panel SHALL NOT block page scrolling, dim content, steal keyboard focus or create a modal dialog. Its manual button-triggered mode SHALL retain a scrim, focus management and Escape dismissal.

#### Scenario: Hover is used
- **WHEN** navigation is exposed by mouse hover
- **THEN** no scroll lock or backdrop is activated

#### Scenario: Explicit menu is opened
- **WHEN** the user clicks Menu on mobile, keyboard or desktop
- **THEN** the existing modal flyout can be dismissed with Escape, the scrim and focus return remain intact

### Requirement: Touch and accessibility
Touch movement SHALL NOT unintentionally open navigation. Keyboard access via the edge hotspot or regular Menu button SHALL remain accessible; reduced motion SHALL remove decorative animation.

#### Scenario: Touch enters the edge
- **WHEN** pointerType is touch
- **THEN** hover preview stays closed until an explicit button click

#### Scenario: Keyboard reveals navigation
- **WHEN** the edge hotspot receives focus
- **THEN** navigation is exposed and Escape closes it

### Requirement: Quiet participant home without lost functionality
The default V2 participant home SHALL not show a decorative welcome heading or "continue where you stopped" subtitle, and SHALL prioritize the action and current grade before secondary widgets on wide screens. It SHALL retain existing task, grade, weekly focus, analytics and AI functionality.

#### Scenario: Desktop first view
- **WHEN** a participant opens their V2 home at a wide desktop viewport
- **THEN** primary recommendation and current level are prominent, with increased whitespace; weekly focus is moved below the first row without being removed
