# 02 · Navigation & app shell

**Официальные источники:**
- [iOS/iPadOS 27 UI Kit — Figma](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27)
- [macOS 27 UI Kit — Figma](https://www.figma.com/community/file/1651309434229735362/macos-27)
- [HIG Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [HIG Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- [HIG Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [HIG Split views](https://developer.apple.com/design/human-interface-guidelines/split-views)

## Задать структуру референсов
| Scenario | Visual target | Impulse location | Keyboard & states |
|---|---|---|---|
| Global toolbar | floated glass, consistent search and utility controls | `frontend/src/App.tsx` + shell styles | Ctrl/Cmd+K, tabbing, all themes |
| Revealable sidebar | compact sidebar, clear current page | `calm-navigation/Sidebar.tsx` | Escape, overlay click, focus restoration |
| Split view | master list / detail inspector | tasks / chat / projects | selection, Back, mobile single pane |
| Tab/segmented | short related views | catalogs / profile | pressed+selected semantically |
| Breadcrumb/back | nested locations | task/project/course | actual route and browser Back |
| Responsive nav | progressive pane collapse | every role | 320px / 390px / desktop |

## Figma extraction checklist
- Frame and constraints (fixed/hug/fill, min/max), safe areas and optical alignment.
- Toolbar height, icon frames, hit areas, left/right insets and scroll layering.
- Sidebar selected/hover/focus/disabled, badges, grouping, disclosure and collapsed versions.
- Different iPadOS/macOS and iOS variants; **don't mix their metrics without recording the platform**.
- Test 49 existing routes/6 roles (or latest authorised route inventory) with actual API/RBAC.
- Compare owner-approved Impulse screenshot first. Apple HIG is a **component grammar**, not permission to change app structure.

**No unverified exact Apple pixel values are asserted in this pack.**
