# Capability: mobile-search-positioning

## ADDED Requirements

### Requirement: Compact mobile search is anchored to the toolbar
At viewport widths up to and including 820 px, the 42 × 42 px magnifying-glass control SHALL remain fully inside the fixed topbar and aligned with adjacent utilities. Legacy offsets from the former two-row search layout SHALL NOT displace it below the toolbar. The search input and results, when expanded, SHALL be placed within the viewport no more than 20 px below the toolbar.

#### Scenario: Compact icon at phone and tablet widths
- **WHEN** an authenticated user visits Home with viewport width 320 px, 390 px, 570 px, 767 px or 820 px
- **THEN** the search trigger's bounding rectangle is contained within the toolbar and the document has no horizontal overflow

#### Scenario: Expanded search input
- **WHEN** the user focuses the compact search trigger on a 390 px viewport
- **THEN** the original input becomes visible just below the toolbar and is not clipped, offscreen or overlapped by the fixed navigation

### Requirement: Anchoring does not change search behavior or desktop layout
The mobile toolbar correction SHALL preserve the authorized API search, canonical result routes, keyboard and focus handling, privacy protections, and all three visual themes. At 1422 px, the full-size desktop search field SHALL retain its original layout.

#### Scenario: Select a permitted search result
- **WHEN** the user searches for an API-authorized task and activates its result at 320 px
- **THEN** the canonical task destination opens, the compact search is restored, and the page remains within viewport bounds

#### Scenario: Desktop and all themes
- **WHEN** the search component renders at 1422 px, or the mobile toolbar is switched between light, blue and midnight
- **THEN** the existing desktop search remains unchanged and the compact/mobile controls retain readable and keyboard-visible focus states
