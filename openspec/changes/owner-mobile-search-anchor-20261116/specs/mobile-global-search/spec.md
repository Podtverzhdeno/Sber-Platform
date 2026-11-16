# Mobile search anchor placement

## MODIFIED Requirements

### Requirement: Global search SHALL use a compact mobile trigger
At viewports of 820 CSS pixels or less, the authenticated search trigger SHALL be a 42-by-42 CSS pixel surface fully contained within the fixed toolbar alongside the other utilities. It SHALL explicitly reset any top/left/right offsets inherited from an earlier two-row mobile layout. Above 820 CSS pixels, the full desktop search layout SHALL remain unchanged.

#### Scenario: Trigger is positioned within the toolbar
- **WHEN** an authorized participant opens the application at 320, 390, 570, 767 or 820 CSS pixels
- **THEN** the icon's bounding box remains within the toolbar bounds, with no horizontal document overflow or displaced floating control

### Requirement: Search expansion SHALL preserve the existing authorized search behavior
At mobile widths, focusing the compact trigger SHALL reveal the unchanged search input within 0 to 20 CSS pixels beneath the fixed toolbar. Both that input and its authorized result links SHALL remain inside visible viewport bounds; existing focus, keyboard, themes and permissions behavior SHALL be retained.

#### Scenario: Search remains usable after opening a result
- **WHEN** a participant at 320 CSS pixels opens compact search, queries a mocked permitted task, and selects the returned item
- **THEN** the result navigates to its canonical authorized task route, no fixed header obscures the input or results, and compact search is restored after navigation

#### Scenario: Desktop search retains the original alignment
- **WHEN** a participant visits the application at 1422 CSS pixels
- **THEN** the full desktop search input remains present in its original topbar location
