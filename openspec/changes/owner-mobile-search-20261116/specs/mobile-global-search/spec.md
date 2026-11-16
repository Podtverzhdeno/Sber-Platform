# Compact global search in authenticated mobile shell

## ADDED Requirements

### Requirement: Global search SHALL use a compact mobile trigger
On authenticated screens at 820 CSS pixels or less, the shared header SHALL present a magnifying-glass search trigger without permanently reserving an additional content row. At desktop widths, the existing full search input SHALL remain visible.

#### Scenario: Participant first opens Home at 390 pixels
- **WHEN** an authenticated participant navigates to Home at 390 CSS pixels without focusing search
- **THEN** search is a visible icon-sized target of at least 42-by-42 CSS pixels, the original topbar controls remain reachable, and main content does not include the previous permanent mobile search offset

### Requirement: Search expansion SHALL preserve the existing authorized search behavior
Activation by click or keyboard focus SHALL reveal the original labeled search input below the toolbar at a readable size of at least 16 CSS pixels. The existing debounce, source-backed results and role-permitted canonical destinations SHALL be reused, not replaced with fabricated or unfiltered content.

#### Scenario: User finds a permitted task
- **WHEN** an authenticated participant focuses search and queries a task available to that actor
- **THEN** results appear below the header and selecting that task navigates to its existing authorized route

### Requirement: Mobile search SHALL collapse cleanly
When the user clicks outside the search surface or chooses a result, the expanded search SHALL close without leaving a second header row or horizontal overflow, while preserving keyboard support and light, blue and midnight appearance.

#### Scenario: User dismisses search
- **WHEN** the expanded search is dismissed at a width of 320 CSS pixels
- **THEN** only the compact search trigger remains in the toolbar and document horizontal scrolling is not introduced
