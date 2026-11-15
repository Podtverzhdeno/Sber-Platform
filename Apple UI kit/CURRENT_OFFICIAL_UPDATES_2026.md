# Apple design updates (verified 15 November 2026)

These dates and changes come from public Apple Developer sources; linked Figma/Sketch **individual layers have not been inspected or measured**.

| Date | Apple source | Verified change | Impulse implication |
|---|---|---|---|
| 2026-11-06 | https://developer.apple.com/design/whats-new/ | Live Activities Figma/Sketch UI kits updated for iOS 27, with macOS components and examples | Study compact project/course status, but do not claim native Live Activities integration |
| 2026-10-28 | https://developer.apple.com/design/human-interface-guidelines/designing-for-macos | macOS guidance adds touch input; keyboard+pointer remain principal inputs | Test desktop mouse, touch, and keyboard without losing information density |
| 2026-09-17 | https://developer.apple.com/design/whats-new/ | iOS/iPadOS 27 and macOS 27 Figma design kits updated | Prefer actual current official kit over third-party iOS 16 |
| 2026-06-08 | https://developer.apple.com/design/whats-new/ | iOS/iPadOS/macOS 27 Sketch kits updated | Specify tool, version and per-frame state before 1:1 reproduction |
| 2026-06-08 | https://developer.apple.com/design/human-interface-guidelines/sidebars | Clarified adaptable sidebars and icon colors | Keep owner-selected hidden-at-rest Impulse drawer, with clear discoverable trigger |
| 2026-06-08 | https://developer.apple.com/design/human-interface-guidelines/tab-bars | Updated tab-bar semantics and art | Tabs navigate; toolbars trigger actions |

## Material contract

Apple HIG: https://developer.apple.com/design/human-interface-guidelines/materials

- Use Liquid Glass in controls/navigation, not every content card, form or message.
- The regular variant supports adaptive legibility. Clear is for visually rich backgrounds; bright content may need a dimming layer.
- CSS backdrop-filter is an approximation, **not** Apple's compositor/refraction.
- Real source measurements + license review + screenshot QA needed for exact transfer.

## Provenance

Public Apple Developer pages: checked. Editable Apple 27 Figma/Sketch document individual frames: **NOT EXAMINED**. No restricted assets or font binaries copied. See 09-progress-feedback-states/LIVE_ACTIVITIES_2026.md and 11-motion-accessibility-responsive/MACOS_TOUCH_2026.md.
