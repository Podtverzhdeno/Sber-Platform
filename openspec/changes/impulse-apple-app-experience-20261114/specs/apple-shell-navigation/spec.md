# Capability: apple-shell-navigation

## ADDED Requirements

### Requirement: Layout shell supports Apple-like focused navigation without route reindexing
The Impulse UI SHALL group only the current actor's authorized `actor.navigation` entries into a calm sidebar and SHALL preserve their original source indexes as `/workspace/:index`. The current destination SHALL remain visible; other groups MAY be collapsed but each authorized entry SHALL remain discoverable, and unknown authorized entries SHALL enter an `Другие разделы` group. The system SHALL NOT create new permissions by grouping.

#### Scenario: A participant with 13 permitted destinations
- **WHEN** a participant opens the navigation and searches for `Рейтинг`, `Аналитика`, `Мои проекты` or `AI-Buddy`
- **THEN** each permitted item resolves to its original route index, including browser reload and Back/Forward, even if visually nested under a group

#### Scenario: Unknown permitted destination
- **WHEN** backend supplies an additional navigation label not listed in static groups
- **THEN** the application shows it in `Другие разделы` with its original route index, not a broken placeholder or a silently removed control

#### Scenario: Not authorized destination
- **WHEN** `actor.navigation` does not include a label
- **THEN** the redesigned sidebar SHALL NOT expose it and direct access SHALL still be checked by server/guard

### Requirement: Shared toolbar is stable and uncluttered
A single global toolbar SHALL provide current context/back, search, notifications and role/account menu. At most one context-primary action and one contextual icon SHALL be permanently prominent; low-frequency commands SHALL be grouped into a labeled menu, not removed.

#### Scenario: Deep-link from search
- **WHEN** a user opens search via Ctrl/Cmd+K and selects an authorized course, message or task
- **THEN** the existing route and source object id SHALL be preserved, and Back SHALL return to search context

#### Scenario: Multiple assigned roles
- **WHEN** the user switches to another assigned role from account settings
- **THEN** navigation and queries SHALL be refreshed to the new role and restricted data from the previous role SHALL no longer be visible

### Requirement: Responsive navigation and inspectors retain capability
Desktop SHALL support sidebar/content/optional inspector; tablet MAY collapse inspector into a sheet; mobile SHALL provide a labeled drawer and full-screen details. Hidden navigation MUST remain reachable by keyboard, touch and screen reader.

#### Scenario: Small screen
- **WHEN** a 320px wide screen opens a participant home and then a project
- **THEN** the primary action, menu opener, project detail, Back and required input SHALL remain usable without page-level horizontal scrolling

#### Scenario: Mobile modal menu
- **WHEN** a user opens the sidebar drawer then presses Escape or selects a route
- **THEN** the drawer SHALL close, focus SHALL restore appropriately and the selected route SHALL remain correct
