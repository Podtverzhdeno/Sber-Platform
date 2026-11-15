# Actual Impulse Apple Glass UI

## ADDED Requirements

### Requirement: The user-approved interface SHALL be mounted at the authenticated default participant home
The deployed application SHALL render the screenshot-measured panel layout using real authenticated data, without showing an obsolete Calm dashboard by default or double-rendering another toolbar.

#### Scenario: Participant opens main dashboard
- **WHEN** an authorized participant opens `/workspace/0` without a legacy query
- **THEN** one floating glass header, one current module panel, one next-level trajectory panel, source-backed metrics and folded tasks/tools are rendered

### Requirement: Visible Menu button SHALL be absent everywhere
The authenticated shell SHALL render a compact Impulse brand instead of the old "Меню" button. The same actor-authorized sidebar SHALL remain reachable by clicking the brand, keyboard, touch, or the desktop left-edge interaction.

#### Scenario: User clicks Impulse brand
- **WHEN** the user clicks the logo on any authorized role route
- **THEN** the existing navigation opens without changing the actor, authorized routes or current tab state

### Requirement: Toolbar SHALL preserve real user functions
Search, activity streak, notification count/list, profile, ranking, help and signout SHALL retain their existing business behavior; non-core controls MAY be moved to a dropdown, but no route/capability can disappear.

#### Scenario: Profile menu
- **WHEN** an authenticated actor opens the avatar dropdown
- **THEN** the actor identity and every authorized profile/ranking/help/signout action are available

### Requirement: Three visible themes SHALL be controlled by one icon
A single icon control SHALL cycle Sun(light), Moon(blue) and MoonStar(midnight), persist the choice and be compatible with light/dark legacy CSS.

#### Scenario: Three clicks
- **WHEN** a user starts from blue and clicks the theme control three times
- **THEN** the mode cycles midnight → light → blue, with corresponding accessible icon labels and the same route

### Requirement: No fabricated progress
An authenticated dashboard SHALL not display guessed courses, grade, skill count or activity metrics. Missing or malformed backend data SHALL not crash the page.

#### Scenario: Role level unavailable
- **WHEN** a participant's published role level returns unavailable
- **THEN** the page shows an unknown level and no fake percentage while leaving navigation usable

### Requirement: Legacy fallback SHALL remain reversible
The existing detailed participant home SHALL remain accessible with `?home=legacy` and `?v2=0` while visual acceptance completes.

#### Scenario: Owner needs rollback
- **WHEN** the user opens `/workspace/0?home=legacy`
- **THEN** the former source-based homepage is available without modifying the user's persisted grades or certificates

### Requirement: Production delivery SHALL be verifiable
A merge SHALL NOT be described as a deployment. The running Railway service SHALL expose the new UI only after a successful exact-commit deployment and HTTP/browser confirmation.

#### Scenario: Code merged but not active
- **WHEN** Railway reports success for an older SHA
- **THEN** no production completion claim is made until the intended SHA becomes live and its browser UI is confirmed
