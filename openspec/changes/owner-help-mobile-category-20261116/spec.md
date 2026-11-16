# Mobile help-center compact navigation · 2026-11-16

## Problem
On small screens the help library shows many category buttons in a horizontally scrollable strip. Some categories are offscreen with no visible cue, conflicting with the requirement that secondary functions remain easy to find and the interface stays minimal.

## Requirements
- At <=600 px the help center SHALL show one labeled, keyboard- and touch-accessible native category selector, with all categories and the existing context/all options.
- At >600 px the original sidebar SHALL remain intact.
- Switching category SHALL preserve its original filtering semantics and reset the search query and currently selected topic.
- Mobile search text SHALL be >=16 px to prevent browser zoom, and primary help close/back/actions SHALL have at least 44 px touch targets.
- The dialog SHALL remain fully within 320, 390 and 768 px viewports without page-level horizontal scroll.
- The original onboarding, topic instructions, links filtered by navigation permissions, focus trap, theme persistence and close behavior SHALL remain unchanged.
- Reduced motion and forced-colors environments SHALL remain usable.

## Acceptance
Vitest help-center category-switch regression; Chromium 320/390/768 with dark/light visual modes, visible vs hidden category controls, help search, close, bounding boxes and touch-target assertions.

## Scope
Only participant help-center TSX, scoped mobile rules in participant-guide.scss, its tests and new isolated E2E. No shared shell, APIs, route table or data changes.
