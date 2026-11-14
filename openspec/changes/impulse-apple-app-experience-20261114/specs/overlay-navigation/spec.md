# Capability: overlay-navigation

## ADDED Requirements

### Requirement: Every workspace keeps the navigation hidden until requested
The application SHALL reserve zero permanent horizontal width for the role sidebar on every authorized desktop, tablet and mobile workspace. A visible labelled 44px menu control SHALL open the same authorized navigation groups without reindexing any route.

#### Scenario: Full-width workspace on desktop
- **WHEN** an authorized participant opens the main screen at 1440px with the menu closed
- **THEN** the side panel SHALL be hidden, the topbar SHALL start at the viewport leading edge, the content SHALL have no reserved 244px navigation column, and the menu button SHALL remain visible

#### Scenario: Operator sees only its assigned routes
- **WHEN** an operator opens the menu from the queue or payment workspace
- **THEN** the drawer SHALL show only server-authorized operator destinations with their original route indexes, without revealing participant or customer actions

### Requirement: A soft translucent overlay does not disrupt work
The sidebar SHALL appear as a floating readable surface over a translucent blurred backdrop. Both entry and exit SHALL animate within 300ms, including a subtle stagger of navigation entries. It SHALL not change the underlying document position or remove form input, evidence or status information.

#### Scenario: Open and close with a full-width project screen
- **WHEN** a user opens then closes the menu while editing a permitted project
- **THEN** the editor and selected object SHALL not be re-created or moved horizontally, no unsaved draft SHALL be discarded, and the backdrop SHALL fade away

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion
- **THEN** the panel and backdrop SHALL open and close without entrance, exit or staggered transitions

### Requirement: Overlay navigation works with keyboard and assistive technology
The drawer SHALL expose a labelled modal dialog only while open, focus the close control on opening, trap keyboard focus, close on Escape or backdrop activation, and restore focus to the trigger. While closed the drawer SHALL not expose interactive controls to assistive technology.

#### Scenario: Keyboard-only navigation
- **WHEN** keyboard user selects the menu and presses Escape
- **THEN** focus SHALL return to the labelled menu button and all underlying content SHALL remain accessible

#### Scenario: Navigate from expanded group
- **WHEN** the user opens the menu, expands `Развитие`, and chooses `Bootcamp`
- **THEN** the original authorized `/workspace/:index` SHALL open, the drawer SHALL close, and the selected group SHALL be marked when reopened

### Requirement: Light and dark modes preserve overlay legibility
The menu SHALL respect existing `impulse-theme` light/dark/system choice and contrast, rendering an independently composed dark translucent panel, while maintaining access at 320px and at 200% zoom.

#### Scenario: Dark theme overlay
- **WHEN** a user switches to `Тёмная` and opens the menu
- **THEN** the surface, text, selected links, focus outline and dimmed background SHALL remain legible and the content SHALL preserve its original data and permissions
