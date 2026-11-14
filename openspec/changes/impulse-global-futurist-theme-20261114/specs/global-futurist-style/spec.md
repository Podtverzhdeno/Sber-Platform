# Capability: global-futurist-style

## ADDED Requirements

### Requirement: All authorized workspaces share a light and dark visual language
The UI SHALL apply the same readable white/dark semantic system to the common app shell and all six role workspaces, including tables, grouped cards, forms, dialogs, analytics, messaging and media-independent flows, without changing business data or APIs.

#### Scenario: White theme across roles
- **WHEN** any assigned role opens any permitted `/workspace/:index` with light theme
- **THEN** the app renders a white/neutral shell with dark legible text, restrained accent, minimal gradients and uniform controls, with all existing functional components still mounted

#### Scenario: Dark theme across roles
- **WHEN** the user chooses dark
- **THEN** the app renders a coherent dark shell and readable surfaces, without hiding critical statuses, deadlines, terms or consent

### Requirement: Switcher persists and tracks system correctly
The toolbar SHALL expose `Светлая`, `Тёмная`, `Системная` to keyboard and touch, persist explicit choices in `impulse-theme`, and follow OS dark/light only in system mode.

#### Scenario: User selects light then reloads
- **WHEN** the user chooses `Светлая` and reloads a destination
- **THEN** `data-theme=light` is restored and the current route/role remains unchanged

#### Scenario: System theme changes
- **WHEN** user chose `Системная` and OS preference changes
- **THEN** root resolved theme changes without user action or navigation and saved explicit choice remains absent

### Requirement: Data and actions cannot disappear under minimalist layout
Secondary tools MAY live in named menu/disclosure, but permissioned destinations, inputs, attachments, confirmations, errors and critical warnings SHALL remain reachable and operable.

#### Scenario: Operator opens dispute under dark theme
- **WHEN** operator navigates to authorized dispute
- **THEN** blocked status and human approval action are preserved and visibly differentiated with accessible text rather than color only

#### Scenario: Participant opens course from home
- **WHEN** participant opens the next known course from Calm Home
- **THEN** the original role course key and canonical Bootcamp route are unchanged
