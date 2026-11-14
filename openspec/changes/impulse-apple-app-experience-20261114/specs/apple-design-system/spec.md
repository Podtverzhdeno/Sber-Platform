# Capability: apple-design-system

## ADDED Requirements

### Requirement: Shared UI has a single calm semantic visual system
The UI SHALL provide neutral light/dark semantic tokens, readable hierarchy, type scale, grouped lists, restrained separators, consistent icons, spacing and responsive layout. The content canvas SHALL NOT be made of unmotivated hero graphics, gradients or a wall of equally dominant cards. Color SHALL emphasize primary action and meaningful statuses only.

#### Scenario: White first fold
- **WHEN** the participant or customer opens the main screen with default light appearance
- **THEN** one clear main task and an unobtrusive group of contextual controls SHALL dominate, while nonessential statistics and rare actions SHALL remain available through named disclosures

#### Scenario: User's dark preference
- **WHEN** the user's saved appearance is dark or follows OS dark mode
- **THEN** the same information hierarchy SHALL remain legible without forcing the white canvas over the user's preference

### Requirement: Materials and content remain meaningfully separated
Translucent "glass-like" material MAY be applied only to navigation or temporary functional overlays when contrast is sufficient. Persistent content, evidence, forms and tables SHALL use opaque semantic surfaces. Apple branding, proprietary fonts/icons or copyrighted screenshots SHALL NOT be bundled.

#### Scenario: Evidence list with sheet
- **WHEN** a mentor opens a contribution inspector
- **THEN** evidence text remains on an opaque readable surface even when the sheet/toolbar has a subtle glass-like treatment

### Requirement: Every shared control has consistent behavior
Buttons, links, toolbars, dialogs, sheets, lists, tables, filters, forms, search, context menus and progress components SHALL follow `docs/design-system-and-behavior.md`: correct semantics, clearly named action, loading/disabled/error, keyboard focus and no duplicate mutation.

#### Scenario: Pending form submit
- **WHEN** a customer submits a task brief while the request is pending
- **THEN** the primary action SHALL not duplicate a request and the interface SHALL show an honest pending state, then server-confirmed result or error

#### Scenario: Required content and optional fields
- **WHEN** a long form enters a step
- **THEN** its required fields and constraints SHALL be discoverable without an unrelated nested menu and advanced optional fields MAY be collapsed in the current step

### Requirement: Visual hierarchy is verified in actual browsers
Screen quality SHALL be assessed in Windows/Yandex Browser as the primary product environment, plus representative Chromium/Safari and mobile. The team SHALL NOT claim pixel-identical native macOS implementation in a cross-platform web app.

#### Scenario: 200 percent zoom
- **WHEN** a user magnifies content 200% at narrow viewport
- **THEN** headings, long labels, actions and details SHALL remain readable, without clipping or required horizontal page scrolling
