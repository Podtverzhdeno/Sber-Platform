# Apple source register (official first)

Last verified 2026-11-15 via Apple Developer Design Resources and HIG. “Listed” means Apple published the kit/link; “layers inspected” means actual Figma/Sketch editable document was opened and measured—**none of the linked proprietary kit layers have been inspected here**.

## Verified official Apple-hosted visual previews (no copied assets)

The two current UI Kit preview images below were resolved from Apple's Design Resources page, not inferred from a filename. They display remotely in [OFFICIAL_VISUAL_GALLERY.md](OFFICIAL_VISUAL_GALLERY.md) and in the [local gallery](reference-gallery.html). They are not checked into the repository.

| Source | Apple-hosted preview URL | Notes |
|---|---|---|
| iOS/iPadOS 27 | https://developer.apple.com/design/resources/images/thumbnails/Thumbnail-UIKit-iOS27_2x.png | Official 27 preview only, not all layers |
| macOS 27 | https://developer.apple.com/design/resources/images/thumbnails/Thumbnail-UIKit-macOS27_2x.png | Official 27 preview only, not all layers |
| Messages template | https://developer.apple.com/design/resources/images/thumbnails/Thumbnail-Tech-Message-Template_2x.png | Template preview; not complete Messages.app UI |
| TipKit template | https://developer.apple.com/design/resources/images/thumbnails/Thumbnail-Tech-TipKit_2x.png | Context-help reference |
| Live Activities template | https://developer.apple.com/design/resources/images/thumbnails/Thumbnail-Tech-Live-Activities_2x.png | Template preview |

Apple also published refreshed 27 Figma resources on **September 17, 2026**: https://developer.apple.com/design/whats-new/ . Reconfirm the source version before measuring individual components.

## Official editable source kits

| ID | Platform | Official link | Tool | Access / certainty |
|---|---|---|---|---|
| APP-IOS27-FIG | iOS & iPadOS 27 UI Kit | https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27 | Figma | Linked from Apple Design Resources; actual layers need Figma |
| APP-IOS27-SKETCH | iOS & iPadOS 27 UI Kit | https://www.sketch.com/s/04c24d8b-38fb-4afb-8836-36617e022f02 | Sketch | Linked from Apple; actual layers need Sketch |
| APP-MAC27-FIG | macOS 27 UI Kit | https://www.figma.com/community/file/1651309434229735362/macos-27 | Figma | Linked from Apple; actual layers need Figma |
| APP-MAC27-SKETCH | macOS 27 UI Kit | https://www.sketch.com/s/57153a31-3379-4737-8ac6-dbfd6525f052 | Sketch | Linked from Apple; actual layers need Sketch |
| APP-WATCH26-FIG | watchOS 26 UI Kit | https://www.figma.com/community/file/1540060090060216489/watchos-26 | Figma | Apple-linked; not targeted for desktop reuse |
| APP-VISION26-FIG | visionOS 26 UI Kit | https://www.figma.com/community/file/1540071341298017505/visionos-26 | Figma | Apple-linked; depth/focus study only |
| APP-MESSAGES-FIG | Messages apps and stickers | https://www.figma.com/community/file/1367916269438172112/imessage-apps-and-stickers | Figma | Apple-linked template, not automatically a full Messages.app UI kit |
| APP-LIVEACT-FIG | Live Activities | https://www.figma.com/community/file/1367915437752334285/live-activities | Figma | Apple-linked; native iOS surface, web only analogue |
| APP-TIPKIT-FIG | TipKit | https://www.figma.com/community/file/1367917705471226837/tipkit | Figma | Apple-linked; contextual help reference |
| APP-WALLET-FIG | Wallet design template | https://www.figma.com/community/file/1367917956770293718/wallet | Figma | Apple-listed; Apple Wallet is not integrated into Impulse |
| APP-APPLEPAY-FIG | Apple Pay | https://www.figma.com/community/file/1367915141082663884/apple-pay | Figma | Apple-linked, do not imply Apple Pay is integrated |
| APP-SIGNIN-FIG | Sign in with Apple | https://www.figma.com/community/file/1367916685468040146/sign-in-with-apple | Figma | Apple-linked; must follow separate branding rules |

**Canonical listing**: https://developer.apple.com/design/resources/ . Apple’s June 23, 2026 announcement confirms the iOS/iPadOS/macOS 27 kits and updated Liquid Glass variants: https://developer.apple.com/news/?id=e2lxw9l1 . Use the canonical listing if a deep link changes; do not download and commit proprietary assets without license review.

## Apple foundation / technology documentation

| Topic | Apple source |
|---|---|
| Human Interface Guidelines entry | https://developer.apple.com/design/human-interface-guidelines/ |
| Design principles | https://developer.apple.com/design/human-interface-guidelines/design-principles/ |
| Apple Design Resources | https://developer.apple.com/design/resources/ |
| Liquid Glass technology | https://developer.apple.com/documentation/technologyoverviews/liquid-glass |
| Adopting Liquid Glass | https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass |
| Materials / standard vs Liquid Glass | https://developer.apple.com/design/human-interface-guidelines/materials |
| Color and adaptive glass | https://developer.apple.com/design/human-interface-guidelines/color |
| Typography | https://developer.apple.com/design/human-interface-guidelines/typography |
| Layout | https://developer.apple.com/design/human-interface-guidelines/layout |
| Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| Dark Mode | https://developer.apple.com/design/human-interface-guidelines/dark-mode |
| Motion | https://developer.apple.com/design/human-interface-guidelines/motion |
| Apple fonts and license | https://developer.apple.com/fonts/ |
| SF Symbols resources/usage | https://developer.apple.com/design/resources/ |
| UIKit system controls | https://developer.apple.com/documentation/uikit/views-and-controls |
| SwiftUI glass effect | https://developer.apple.com/documentation/swiftui/view/glassEffect%28_%3Ain%3A%29 |
| SwiftUI Glass and variants | https://developer.apple.com/documentation/swiftui/glass |
| GlassEffectContainer | https://developer.apple.com/documentation/swiftui/glasseffectcontainer |

## Apple HIG component references

| Navigation and structure | Source |
|---|---|
| Sidebars | https://developer.apple.com/design/human-interface-guidelines/sidebars |
| Tab bars | https://developer.apple.com/design/human-interface-guidelines/tab-bars |
| Toolbars | https://developer.apple.com/design/human-interface-guidelines/toolbars |
| Search fields | https://developer.apple.com/design/human-interface-guidelines/search-fields |
| Lists and tables | https://developer.apple.com/design/human-interface-guidelines/lists-and-tables |
| Menus | https://developer.apple.com/design/human-interface-guidelines/menus |
| Sheets | https://developer.apple.com/design/human-interface-guidelines/sheets |
| Buttons | https://developer.apple.com/design/human-interface-guidelines/buttons |
| Text fields | https://developer.apple.com/design/human-interface-guidelines/text-fields |

For other controls (segmented controls, toggles, sliders, pickers, popovers, alerts, date pickers, progress indicators, navigation bars, disclosure groups, collections, charts, drag-and-drop, symbols), navigate the **Components / Patterns** topics under the official HIG index. Unverified deep-links are intentionally not asserted as inspected.

## Distinguish source types

- **Official Apple**: Apple Developer links and design-kit links directly exposed on Apple Design Resources.
- **User-supplied third-party reference**: iOS 16 UI Kit for Figma by Joey Banks, source URL saved in `openspec/changes/impulse-apple-app-experience-20261114/docs/uikit-ios16-figma-reference-contract.md`; it is **not** an official Apple 27 kit and its exact node was not accessible to a public reader.
- **Impulse-owned source**: current JSX/CSS and approved user screenshot in `docs/design/`; not screenshots of Apple apps.
- **This kit**: web approximation and implementation mapping; independent work, not Apple code.

## Native-to-web limitations

A Figma/Sketch layout can be *measured* and reimplemented in HTML/CSS, but a native SwiftUI `glassEffect` and the browser `backdrop-filter` are different renderers. Any unmeasured CSS token in this folder is labeled a **proposed Impulse web value**, not an official Apple token. Source URLs may require login/terms; follow Apple/Figma licensing before use.
