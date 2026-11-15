<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 01 — Navigation, sidebar, toolbar

**Target:** `frontend/src/features/calm-navigation/Sidebar.tsx`, `sidebar.scss`; `frontend/src/App.tsx`.

**Official refs:** [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [macOS 27 Figma](https://www.figma.com/community/file/1651309434229735362/macos-27).

## Reference breakdown

- **macOS full sidebar:** title section, grouped rows, leading icon + text, selected row, group disclosure, bottom contextual actions. Layer: functional navigation, regular Liquid Glass where appropriate.
- **Toolbar:** compact actions aligned with content; focus and hover states; a single clear primary action.
- **iPad adaptive sidebar:** split view or temporary sidebar, no permanent forced 260px on narrow viewports.
- **iPhone tab navigation:** tabs are *destinations*, not commands; overflow handled intentionally. Don't transplant native tab bar to desktop web without UX justification.

## Frame/state checklist

| Scenario | Reference state | IMPULSE behavior to preserve |
|---|---|---|
| Initial | unselected/selected nav items | server-authorized list of routes and active role |
| Expand | grouped collapsed/expanded sections | existing `expandedGroup` and active group |
| Narrow | hover flyout vs explicit drawer | hover is non-modal; drawer is modal |
| Keyboard | focus-visible, Escape | return focus, trap only when modal |
| Theme | light/dark | existing `data-theme` and CSS classes |

## Transfer notes

Only style `calm-sidebar` classes or compatible variables after verifying actual DOM structure. The component already has nav model, role switching, drawer/hover logic; **do not rewrite this logic**. Use `NavLink` selected state. Reuse `lucide-react`, not Apple SF Symbols. Don't recreate macOS window traffic lights.
