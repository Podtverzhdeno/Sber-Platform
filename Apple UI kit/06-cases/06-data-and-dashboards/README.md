<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 06 — Data tables, cards, lists and dashboards

**Target:** `frontend/src/features/analytics-v3/page.tsx`, task catalog, dashboards, `frontend/src/components/ui.tsx` `DataTable`, `Card`.

**Official refs:** [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators), [macOS 27 kit](https://www.figma.com/community/file/1651309434229735362/macos-27).

## Cases

- Data-heavy panel: **solid material**, no translucent rows behind real text.
- KPI cards: hierarchy label > value > context, tabular numbers; error/unknown/zero must differ.
- Tables: scroll container, sticky header where practical, numeric alignment, sorting accessible through header buttons, keyboard scroll.
- Lists: grouping, selected state, bulk actions, loading, empty and error states.
- Charts: legends, high contrast and textual summary; don't convey direction only by hue.
- Progress: determinate vs indeterminate, explicit label, meaningful progress text.

## Critical project details

IMPULSE `DataTable` currently has accessible caption, column scope and focusable scroll region. Preserve it. Analytics modules use actual data from API; don't replace unknown counts with fictitious defaults or mock results on production routes. Avoid flashy animation over metrics.
