# Capability: participant-five-section-content-first

## ADDED Requirements

### Requirement: Five participant groups expose all authorized existing destinations without changing access
The participant navigation SHALL present the groups Развитие, Практика, Результаты, Сообщество, Дополнительно, with Главная separately reachable. Grouping and local content tabs SHALL be presentation only: every exposed destination SHALL exist in the current server actor.navigation, retain its original /workspace/:section index and preserve existing deep-link query keys. Unknown but authorized destinations SHALL remain reachable. No group MAY expose other-role routes.

#### Scenario: Navigate from a grouped item
- **WHEN** a participant selects "Практика" then "Мои проекты"
- **THEN** the destination opens at its original backend-authorized section index, browser Back restores the prior location and no new privilege is granted

#### Scenario: Missing destination
- **WHEN** the server omits "Рейтинг" from the participant's allowed list
- **THEN** no group or local shortcut presents a working link to that unavailable screen

### Requirement: First fold prioritizes the next truthful action over cosmetic metrics
Every group SHALL show its heading, a small set of subsection choices, truthful current context and at most one dominant primary action. It SHALL NOT repeat the removed home KPI strip or fabricate a role level, skills count, assignment status, unread messages or rating. Critical blocking state, deadline or necessary course MUST be immediately discoverable.

#### Scenario: Participant has no assignment
- **WHEN** the practice view receives an empty authorized assignments response
- **THEN** it shows a useful route to the task catalog, not a fictitious in-progress card

### Requirement: Development remains one continuous route from role to course and practice
The Development group SHALL offer Trajectories, Courses and Levels, preserving one primary role and optional learning roles. Unselected role previews SHALL not display invented personal progress. Toggling an optional role off SHALL keep completed study/history and SHALL not alter the primary. Each real curriculum level SHALL disclose the **specific required courses and practices**, and a permitted course step SHALL navigate to Bootcamp with track and course context.

#### Scenario: User opens a grey optional role
- **WHEN** a participant selects an unselected profession and activates optional study
- **THEN** the role becomes a non-primary enrolled learning role, and disabling it returns the card to grey while preserving already earned evidence

#### Scenario: Next level needs additional courses
- **WHEN** level L1 has two unfinished required courses
- **THEN** the participant can see both named courses and open each, without a generic unexplained "Next grade" action

### Requirement: Practice supports a complete non-blocking educational submission journey
The Practice group SHALL expose task discovery, current assignments and project workspaces. Task details SHALL preserve problem, deliverable, acceptance, payment/terms and permission constraints. Work submission SHALL be idempotent and show the server's immediate study credit when applicable; independent professional review, project acceptance and payouts SHALL remain separate state machines. Revision and evidence history SHALL be retrievable.

#### Scenario: Submit a practice task
- **WHEN** an assigned participant sends a valid personal result once
- **THEN** any policy-eligible educational practice credit is shown from the server, the submission is not duplicated, and the professional review status remains independently visible

### Requirement: Results distinguish confirmed evidence from aspiration and estimates
Results SHALL contain Portfolio, Analytics, Achievements and Rating where authorized. Analytics SHALL offer the participant's actual sourced progress plus target and coverage/definition; unknown personal measurement SHALL NOT be plotted as zero. Public ranking and sharing SHALL honor consent. Unverified achievements SHALL NOT be represented as confirmed.

#### Scenario: No personal metric data
- **WHEN** a competency target exists but measured progress is unavailable
- **THEN** the plot clearly marks actual value unknown with an explanatory state, rather than mirroring target as current

### Requirement: Community preserves events, favorites and contextual messenger
Community SHALL expose Events and Messages where authorized. Event favorites SHALL be accessible by a named button with no dark enclosing badge frame, and favorite SHALL NOT mean attendance or verification. Messaging SHALL preserve sending, attachments, errors, unread, project/team context and permissions. On mobile context SHALL be a separate view rather than a permanent narrow inspector.

#### Scenario: Narrow chat
- **WHEN** a participant opens a project thread at 320px
- **THEN** the conversation, message composer and contextual details remain reachable without document-level horizontal scrolling or hiding the send result

### Requirement: Additional utilities remain permission-bound and useful
Additional SHALL present only authorized AI Buddy/Settings/help capabilities. AI-generated advice SHALL disclose when live service/data is unavailable and SHALL NOT automatically submit user work or leak private profile data. Role switch SHALL remain controlled by assigned roles and server policy.

#### Scenario: AI Buddy unavailable
- **WHEN** the AI service is disabled or permission is absent
- **THEN** it does not claim to have generated live advice; ordinary course and task navigation remains functional

### Requirement: Overlay navigation and theme-aware responsive hierarchy
The global group navigation SHALL be closed on initial load on desktop and mobile and SHALL open without reserving canvas width. Escape and outside click SHALL dismiss the overlay and restore focus. All five groups and Home SHALL remain accessible without hover.

#### Scenario: Mobile overlay
- **WHEN** a participant opens global navigation at 320px and presses Escape
- **THEN** the overlay closes, focus returns to its opener, the page remains at the same position, and no authorized destination is lost

#### Scenario: Theme and reduced motion
- **WHEN** system preferences request reduced motion or transparency
- **THEN** all navigation and content remain usable without mandatory animations and translucent text backgrounds

### Requirement: All first-fold designs must pass evidence-driven acceptance
Implementation SHALL include deterministic component tests, authorized role/deeplink regression, E2E user journeys for the five groups and screenshot comparison to **owner-provided** references on exact commit SHA. Authoring the spec or merging a code commit SHALL NOT be reported as proof of production deployment or visual parity.

#### Scenario: A new layout passes unit tests only
- **WHEN** the new landing is committed but browser E2E/screenshot review is incomplete
- **THEN** the implementation is reported as partial and the remaining acceptance gates are explicitly enumerated
