# Capability: global-role-nav

## ADDED Requirements

### Requirement: Sidebar groups exactly the server-authorized destinations without route reindexing
`CalmSidebar` SHALL receive the current actor's navigation (or existing conditional customer demo override), group it visually, preserve original `/workspace/:index` and aria-current on the active route, and never create unauthorized destinations.

#### Scenario: Full participant navigation
- **WHEN** participant opens `Результаты` group then selects `Рейтинг`
- **THEN** the original authorized index is navigated and the selected row is highlighted

#### Scenario: Unknown authorized label
- **WHEN** the actor navigation includes an unknown label
- **THEN** it remains visible under a fallback group with its original index and is accessible by keyboard

#### Scenario: Customer demo override
- **WHEN** demo customer has `Создать задачу` in client-provided navigation
- **THEN** the same link is available only in that demo mode, not invented for real customers

### Requirement: Mobile drawer is accessible and reversible
Drawer SHALL open through a labelled control, trap focus while open, close on Escape/backdrop/route, and not intercept content when closed.

#### Scenario: Mobile navigation
- **WHEN** a 390px participant taps `Меню`, expands `Развитие` and opens `Bootcamp`
- **THEN** the drawer closes and focus returns safely without mutating learning progress

### Requirement: Role-switch respects backend constraints
Role chooser SHALL include only assigned roles and use existing onSwitchRole callback.

#### Scenario: Assigned mentor and participant
- **WHEN** assigned multi-role user changes role
- **THEN** navigation/selection updates to backend-authorized role without displaying cached unrelated private data in sidebar
