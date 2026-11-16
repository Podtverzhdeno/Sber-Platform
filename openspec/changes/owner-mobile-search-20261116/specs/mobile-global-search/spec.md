# Capability: mobile-global-search

## ADDED Requirements

### Requirement: Global search stays compact in a narrow authenticated toolbar
At viewport widths up to and including 820 px, authenticated global search SHALL initially appear as a compact magnifying-glass control in the topbar with a touch target of at least 42 px. Activating or keyboard-focusing it SHALL reveal the original labeled search input below the toolbar, with a font size of at least 16 px, without permanently reserving a second header row. At desktop widths, including 1422 px, the full search field SHALL remain visible.

#### Scenario: Default mobile search at 320 px
- **WHEN** an authenticated participant enters Home at a 320 px viewport before interacting with search
- **THEN** the toolbar contains the compact search control, the expanded input is not occupying a permanent second row, and the document does not horizontally overflow

#### Scenario: Focus and keyboard activation
- **WHEN** the participant activates the compact control by touch or keyboard at 390 px or 820 px
- **THEN** the original labeled 16 px search input appears immediately below the toolbar and remains fully reachable without clipping

#### Scenario: Desktop remains expanded
- **WHEN** an authenticated participant opens the toolbar at 1422 px
- **THEN** the existing fully labeled search field remains available without the compact mobile layout

### Requirement: Search overlay preserves authorization and dismissal
Compact-mode presentation SHALL reuse existing live search requests, debounce, route selection, keyboard interactions, and server-authorized results. Choosing a result or clicking outside SHALL dismiss the expanded search and restore the compact icon without modifying the underlying route authorization, privacy controls, or search API.

#### Scenario: Authorized search result
- **WHEN** an actor searches for an API-authorized task and selects the result
- **THEN** the canonical permitted task route opens, and the temporary mobile search surface collapses

#### Scenario: Close by outside interaction
- **WHEN** the mobile search input is expanded and the participant clicks outside its overlay
- **THEN** the overlay closes and the original compact toolbar layout is restored without a lingering second row

#### Scenario: Theme and accessibility settings
- **WHEN** mobile search is opened in light, blue, midnight, reduced-transparency or forced-colors modes
- **THEN** the control, input, focus state and results remain visible and operable without removing data or permissions
