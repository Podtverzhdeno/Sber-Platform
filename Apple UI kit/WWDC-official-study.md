# Apple design learning path · original references

**Date:** 2026-11-15. These links point to Apple first-party documentation and videos. Source platform and publication date are crucial: a 2025 iOS 26 example is not automatically an exact iOS 27 standard.

## 2026/2027 platform baseline

1. [Apple iOS + iPadOS 27 Figma UI Kit](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27)
2. [Apple iOS + iPadOS 27 Sketch UI Kit](https://www.sketch.com/s/04c24d8b-38fb-4afb-8836-36617e022f02)
3. [Apple macOS 27 Figma UI Kit](https://www.figma.com/community/file/1651309434229735362/macos-27)
4. [Apple macOS 27 Sketch UI Kit](https://www.sketch.com/s/57153a31-3379-4737-8ac6-dbfd6525f052)
5. [Apple Design Resources (includes watchOS 26, visionOS 26 and templates)](https://developer.apple.com/design/resources/)
6. [Apple June 23, 2026 announcement — kit updates](https://developer.apple.com/news/?id=e2lxw9l1)
7. [Apple September 2026 design changes index](https://developer.apple.com/design/whats-new/)

**Access note:** public Figma/Sketch kit landing pages can require their app/login for editing and precise layer metrics. The links were confirmed as Apple Design Resources destinations; **internal Figma component details were not retrieved here**.

## Liquid Glass and contemporary design principles

- [HIG Materials — regular/clear and standard content material](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Introduction to Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
- [WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) — dynamics, adaptivity, principles.
- [WWDC25 Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/) — design language, structure, continuity; concentric shapes, scroll-edge treatment, floating controls.
- [WWDC25 Build an AppKit app with the new design](https://developer.apple.com/videos/play/wwdc2025/310/) — macOS toolbars, sidebar, scroll edge.
- [WWDC26 What's new in SwiftUI](https://developer.apple.com/videos/play/wwdc2026/269/) — Liquid Glass 2027 refinements and adaptive/resizable apps.
- [WWDC26 Design Guide](https://developer.apple.com/wwdc26/guides/design/) — index of platform/interaction sessions.

## Working with the source

Choose one platform and component layer, not a mix of screenshots across OS generations. For the selected design:
1. Record UI kit version/file URL/Figma component ID and local export permissions.
2. Capture all variants: standard, hovered, selected, disabled, focused, pressed, loading, dark, reduced transparency.
3. Copy dimensions **from actual layer properties**, not from the Impulse demo CSS.
4. Map to a single real React component, audit handlers/permissions.
5. Compare screenshot to the actual Impulse browser output at matching conditions in [compare.html](./compare.html).
6. Repeat after resizing and keyboard interaction; hand off to independent reviewer.
