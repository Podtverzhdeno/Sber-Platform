# 09 — Search, filter and commands

**Apple references:** [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields), [Menus](https://developer.apple.com/design/human-interface-guidelines/menus), [macOS UI Kit 27](https://www.figma.com/community/file/1651309434229735362/macos-27).

## Reference variants

1. Search field idle / focused / typing / clear.
2. Suggestions over content, recent searches, grouped results and no results.
3. Async results: loading indicator, access denied, partial service outage and network retry.
4. Command palette — desktop web convention (`Ctrl/⌘+K`), not a literal clone of system Spotlight.
5. Filter chips and sorting state; selected filter remains readable on dark background.

## IMPULSE constraints

Use actual authorized search results (tasks, courses, events, people, messages); do not expose restricted items before role-based authorization. In `frontend/src/App.tsx`, find existing search kind labels and route navigation before replacing UI. Preserve deep links and keyboard semantics.

## Acceptance

Esc closes, Enter selects, arrow keys move among actual options, expanded state is exposed through ARIA, asynchronous results are announced meaningfully, no focus loss after route change. Empty and error states must be visually distinct.
