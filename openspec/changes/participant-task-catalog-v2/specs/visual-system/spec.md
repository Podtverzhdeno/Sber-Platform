# Visual System Delta

## ADDED Requirements

### Requirement: Task catalog v2 follows registered approved references

The visual system SHALL use registered references `01_tasks_cards_approved`, `02_conditions_modal_approved` and `03_tasks_list_approved` for the information hierarchy and visual acceptance of `/workspace/3`. Implementation SHALL reuse the existing application shell, semantic tokens, theme and primitives rather than creating a parallel shell or importing screenshot colors as an independent global system.

#### Scenario: Cards reference is reviewed

- **WHEN** the deterministic desktop fixture renders in cards mode near the approved viewport
- **THEN** compact cards occupy the catalog column, selected-task detail remains readable, skill forecast and compact horizontal stage plan are present
- **AND** the removed «Итог» block is absent

#### Scenario: List reference is reviewed

- **WHEN** the same fixture renders in list mode
- **THEN** columns remain scannable, the selected row is clear and values/order match cards mode

#### Scenario: Conditions reference is reviewed

- **WHEN** current task conditions open
- **THEN** the backdrop, structured modal content and fixed action area follow the approved hierarchy
- **AND** real terms fields determine visible content

### Requirement: Task catalog v2 is responsive and theme-safe

Cards, list, detail and conditions SHALL remain operable at desktop, tablet and 390 px mobile widths and in light/dark themes. Mobile SHALL use readable stacked rows rather than shrinking a desktop table into microtext.

#### Scenario: AT-15 mobile catalog

- **WHEN** a participant uses a 390 px viewport
- **THEN** selection, match text, task facts and CTA remain reachable without page-level horizontal scrolling
- **AND** the conditions dialog can be closed by keyboard and pointer

#### Scenario: Tablet list

- **WHEN** width is insufficient for all desktop columns
- **THEN** lower-priority facts move into an accessible expandable row
- **AND** selected task and primary action remain visible

### Requirement: Task visual states are accessible and non-deceptive

Selected, bookmarked, ineligible, loading, empty, error, offline, submitted and closed states SHALL be distinguished by text/structure in addition to color. Focus indicators, reduced motion, zoom 200–400% and minimum platform target size SHALL be supported.

#### Scenario: Keyboard participant traverses the catalog

- **WHEN** a participant navigates controls without pointer
- **THEN** focus order follows search, filters, results, selected detail and actions logically
- **AND** nested bookmark/action controls do not trigger unintended row selection



### Requirement: Task detail workflow uses accessible roving tabs

The four task-detail workflow sections (overview, criteria, solution and review) SHALL be represented by an accessible tablist with exactly one selected tab and one tab stop in the tab set. Left/right and up/down arrow keys SHALL select and focus adjacent tabs with wraparound; Home and End SHALL focus the first and last tab. Activating sections SHALL NOT mutate assignment, consent, review or verification state. The associated tabpanel SHALL expose a programmatic name and be keyboard reachable.

#### Scenario: Keyboard user inspects a task

- **WHEN** an authorized participant opens task details, focuses the "О задаче" tab and presses Right, End, Home and Left
- **THEN** focus and the accessible selected state follow the requested sections in their documented order
- **AND** the associated panel is announced without any application or review side effect

### Requirement: Workflow controls are readable and touch-operable in all visual modes

Task-detail tabs, primary workflow actions and stage-plan disclosure SHALL provide at least 44 CSS pixels of hit-area height across 320, 390 and 1440 CSS pixel widths. Light mode SHALL use an opaque pale surface with legible labels and a distinct selected state; blue and midnight SHALL retain their established semantic accents. Reduced-motion mode SHALL not require animations for comprehension.

#### Scenario: Participant switches sections on a narrow light-theme screen

- **WHEN** a participant opens task details at 320 CSS pixels with the light theme
- **THEN** every workflow section is reachable without horizontal page overflow
- **AND** the selected tab and task panel remain visually distinct and readable with 44 CSS pixel minimum hit targets
