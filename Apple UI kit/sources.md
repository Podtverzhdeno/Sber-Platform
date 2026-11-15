# Primary Apple design sources — official landing pages

**Checked:** 2026-11-15. Source version matters; prefer the exact Apple-provided package for the target platform (iOS/iPadOS **27**, macOS **27**, watchOS, tvOS, visionOS where offered). Official links may redirect to Figma/Sketch and can require acceptance/sign-in. **Do not infer layer measurements from previews.**

## Downloadable kit and tools
- **Apple Design Resources (master index, Figma and Sketch kits, templates, production resources):** https://developer.apple.com/design/resources/
- **Human Interface Guidelines (master):** https://developer.apple.com/design/human-interface-guidelines/
- **Apple Design — Liquid Glass overview and introduction:** https://developer.apple.com/design/
- **SF Symbols:** https://developer.apple.com/sf-symbols/
- **SF Fonts and typography resources:** https://developer.apple.com/fonts/
- **Apple UI Design dos and don'ts / branded resources:** https://developer.apple.com/design/

Do not commit downloaded fonts or native UI kits until distribution rights are checked.

## Materials, structures, interaction
- **Materials / Liquid Glass:** https://developer.apple.com/design/human-interface-guidelines/materials
- **Color:** https://developer.apple.com/design/human-interface-guidelines/color
- **Typography:** https://developer.apple.com/design/human-interface-guidelines/typography
- **Icons:** https://developer.apple.com/design/human-interface-guidelines/icons
- **Layout:** https://developer.apple.com/design/human-interface-guidelines/layout
- **Accessibility:** https://developer.apple.com/design/human-interface-guidelines/accessibility
- **Motion:** https://developer.apple.com/design/human-interface-guidelines/motion
- **Toolbars:** https://developer.apple.com/design/human-interface-guidelines/toolbars
- **Sidebars:** https://developer.apple.com/design/human-interface-guidelines/sidebars
- **Tab bars:** https://developer.apple.com/design/human-interface-guidelines/tab-bars
- **Search fields:** https://developer.apple.com/design/human-interface-guidelines/search-fields
- **Menus:** https://developer.apple.com/design/human-interface-guidelines/menus
- **Buttons:** https://developer.apple.com/design/human-interface-guidelines/buttons
- **Text fields:** https://developer.apple.com/design/human-interface-guidelines/text-fields
- **Alerts:** https://developer.apple.com/design/human-interface-guidelines/alerts
- **Sheets:** https://developer.apple.com/design/human-interface-guidelines/sheets
- **Split views:** https://developer.apple.com/design/human-interface-guidelines/split-views
- **Disclosure controls:** https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- **Progress indicators:** https://developer.apple.com/design/human-interface-guidelines/progress-indicators
- **Feedback:** https://developer.apple.com/design/human-interface-guidelines/feedback
- **Writing:** https://developer.apple.com/design/human-interface-guidelines/writing

Individual HIG slugs are navigation references; Apple may change or redirect them. Review official HIG search if a link is relocated.

## Official technical platform docs
- **UIKit:** https://developer.apple.com/documentation/uikit
- **SwiftUI:** https://developer.apple.com/documentation/swiftui
- **AppKit:** https://developer.apple.com/documentation/appkit
- **Liquid Glass in apps:** https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- **What's new in Apple design (WWDC sessions index):** https://developer.apple.com/videos/design/

**Important distinction:** native SwiftUI `glassEffect`, UIKit/AppKit materials and automatic system-control rendering are platform APIs, *not* equivalent to browser CSS `backdrop-filter`. The Impulse web gallery illustrates only web-safe interpretations.

## App-level references (behavior, not downloadable pixels)
Apple Mail (three-column/navigation), Messages (conversation pane), Settings (grouped rows), Reminders (smart lists), Notes (sidebar/inspector), Photos (content-first). Use HIG first; app screenshots are additional visual checkpoints, not a license to redistribute Apple assets.

## Collection protocol for a 1:1 conversion
Record: URL -> UI kit release/version -> platform -> Figma/Sketch component path -> light/dark and state -> frame size, typography and spacing measurements -> exported permitted source screenshot -> Impulse target selector -> test viewport/device pixel ratio -> screenshot diff evidence. Put derived measurements in a separate file with attribution and date, *not* as presumed canonical values.
