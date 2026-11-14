# Capability: apple-progressive-workflows

## ADDED Requirements

### Requirement: Each screen exposes one main task and easy secondary depth
Each main workspace SHALL show its current object, state and primary safe action at L0; L1 secondary lists/filters/related tools SHALL be reachable with clear labels; L2 history, artifacts, analytics, policy and audit SHALL open via contextually named details/inspector. Main flow actions SHALL NOT require navigating into a third "More" submenu.

#### Scenario: Course journey
- **WHEN** a participant selects the currently recommended course from Home
- **THEN** the exact authorized Bootcamp course opens, its lesson and linked practice remain available, and the user can return without losing trajectory context

#### Scenario: Review queue
- **WHEN** a mentor opens a pending contribution
- **THEN** review-related evidence and explicit human actions are visible in split detail or fullscreen mobile view, while older history can be in an inspector tab

### Requirement: Selection and unsaved work survive navigation
Filters, selected row, scroll context, opened details and form input SHALL be preserved to the degree the current backend and route permit. Closing an inspector/sheet SHALL return focus; dirty forms SHALL warn before loss. The redesign SHALL NOT erase attachments, drafts or response errors during route navigation.

#### Scenario: Customer wizard drafts
- **WHEN** a customer moves between brief steps and opens a preview
- **THEN** all entered values, terms and validation messages remain, and any unsaved state is distinguished from a server-saved draft

#### Scenario: Message draft
- **WHEN** a user opens conversation details and returns to the chat
- **THEN** typed message and selected attachments SHALL not disappear from local UI state without explicit discard

### Requirement: Smart disclosure is accessible and resilient
Disclosure, menu, sheet, inspector and tab controls SHALL expose their names/states, work with keyboard and touch, respect Escape and reduced motion, and preserve screen-reader reading order. Failures in L1/L2 GET queries SHALL not replace authorized L0 functionality with fabricated results.

#### Scenario: Slow requirements API
- **WHEN** the role level exists but the course catalog is temporarily unavailable
- **THEN** the required-course panel SHALL show a retry or an authorized trajectory fallback, without inventing course names or completion

#### Scenario: Hidden auxiliary features
- **WHEN** a user presses the `Инструменты` disclosure
- **THEN** only granted destinations appear, each at most two context-level interactions away from its relevant page
