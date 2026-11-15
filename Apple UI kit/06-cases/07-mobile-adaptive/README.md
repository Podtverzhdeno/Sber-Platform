<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 07 — Responsive adaptation

**Targets:** all shell layouts and navigation surfaces; mobile collaboration, task catalog, settings.  
**Official refs:** [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [iOS/iPadOS 27 kit](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27).

## Required viewport matrix (web test fixtures, NOT Apple canonical)

| Width | Expected behavior |
|---|---|
| 390px | no horizontal overflow; drawer instead of persistent sidebar; messages single view |
| 820px | collapsible nav/split where sufficient; controls can wrap |
| 1280px | persistent sidebar; toolbars with all critical actions |
| 1440px | stable max content width, no stretched reading lines |

## Cases

- portrait narrow with long RU names, 200% zoom and on-screen keyboard.
- sticky toolbar + scrolling content + modal/popup.
- browser not supporting backdrop-filter.
- touch without hover, keyboard without mouse, reduced motion.
- Dynamic safe area usage; don't reproduce iOS status bar or home indicator in a website.
- Adapt action density to available width, not to Apple device model.
