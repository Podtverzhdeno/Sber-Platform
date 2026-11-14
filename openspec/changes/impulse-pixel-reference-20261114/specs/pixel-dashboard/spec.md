# Impulse Pixel Dashboard

## ADDED Requirements

### Requirement: Pixel reference layout
At desktop 1422×803 the main Impulse participant surface SHALL follow the measured screenshot's floating toolbar, hero / trajectory grid, metric row, progress and folded details. Other viewports SHALL retain all content and actions in responsive layout.

#### Scenario: Desktop
- **WHEN** a logged-in participant opens their workspace home at 1422×803
- **THEN** the toolbar is 62px high and the first hero/trajectory row appears as approximately 793px and 334px cards with a 21px gap

### Requirement: Three click themes
A single compact topbar control SHALL cycle three visible modes, each with a distinct correct icon: sun, blue moon, dark moon. The current choice SHALL be user-controlled, not implicitly a data fabrication.

#### Scenario: Click sequence
- **WHEN** the user repeatedly clicks the theme control
- **THEN** the modes progress light → blue → midnight → light, retaining search and navigation accessibility

### Requirement: No visible hamburger but no lost navigation
The toolbar SHALL have an Impulse brand button but SHALL NOT show a decorative Menu text/button. It SHALL preserve click/touch and keyboard entry into the user's authorized routes, and edge-hover on capable desktop devices.

#### Scenario: Brand click
- **WHEN** the user clicks the Impulse logo on mobile or desktop
- **THEN** an authorized navigation flyout opens using the existing role model, without bypassing ACLs

### Requirement: Source-backed actions and stats
The dashboard SHALL display only server-supplied stats and expose working callbacks to existing course/task, trajectory, search, help, ranking, notifications and signout handlers. Unknown fields SHALL be absent or shown as unknown rather than invented.

#### Scenario: Missing learning data
- **WHEN** no verified course progress is available
- **THEN** the module progressbar is absent and the user is not shown a fake completion percentage

### Requirement: Generated wallpaper separate from content
An original generated text-free background SHALL render beneath foreground cards and floating toolbar. It SHALL degrade appropriately for reduced transparency and forced colors.

#### Scenario: High contrast
- **WHEN** forced-colors is active
- **THEN** cards retain visible borders and text, and the image does not become the primary navigation affordance

### Requirement: Shared-component ownership
The independent reference SHALL NOT be wired by an author who lacks the shared App/theme/sidebar/home claim. Handoff SHALL supply source evidence and acceptance tests.

#### Scenario: Active integration claim
- **WHEN** another live claim owns App.tsx or CalmParticipantHome
- **THEN** the reference remains isolated pending the integration owner's explicit handoff
