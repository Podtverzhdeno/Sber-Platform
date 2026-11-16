# Capability: participant-help-mobile-categories

## ADDED Requirements

### Requirement: Mobile help categories remain discoverable without horizontal scrolling
At viewport widths of 600 px or less, the participant help center SHALL expose every authorized help category, including the contextual and all-topics selections, through one native, keyboard-accessible, labeled selector. The category selector SHALL remain visible inside the help dialog without horizontal overflow. Above 600 px the existing category sidebar SHALL remain available.

#### Scenario: Narrow help dialog with all topic categories
- **WHEN** a participant opens the help center at 320 px or 390 px and navigates category options by touch or keyboard
- **THEN** every available category is selectable without horizontally scrolling a category strip, and the selected category filters the same articles as before

#### Scenario: Switch category while searching a topic
- **WHEN** a participant has entered a help query and opened a topic, then selects another category
- **THEN** the existing filtering semantics apply and both the search query and selected topic are reset

#### Scenario: Desktop retains the original navigation
- **WHEN** the help center is opened above 600 px, including 768 px and 1440 px
- **THEN** its original category sidebar remains visible, and the compact mobile category control does not replace it

### Requirement: Compact help controls preserve access and responsive behavior
The help center SHALL preserve authorized support links, onboarding content, keyboard focus handling, close and Back behavior, theme persistence, and usability in reduced-motion and forced-colors settings. Mobile search text SHALL be at least 16 px, key controls SHALL have at least 44 px touch targets, and the dialog SHALL fit 320 px and 390 px wide viewports without page-level horizontal scrolling.

#### Scenario: Search, close and focus on a small screen
- **WHEN** a participant searches help, opens a topic, then presses Escape or uses the close control at 320 px
- **THEN** the help content is readable, search does not trigger mobile browser zoom, and the existing close/focus behavior is preserved

#### Scenario: Restricted support destination
- **WHEN** an actor's navigation permissions exclude a help-linked destination
- **THEN** the help center SHALL NOT expose the unauthorized destination through its category or topic actions
