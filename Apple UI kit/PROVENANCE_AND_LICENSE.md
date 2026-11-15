# Provenance, copyright and technical limits

This is a curated index and independently authored web prototype. It does not contain or sublicense Apple-owned design sources.

1. **Official editable design files:** visit https://developer.apple.com/design/resources/ and follow its Figma/Sketch links. Accept the applicable **Apple Design Resources EULA** in your design tool. Figma’s licensing workflow: https://help.figma.com/hc/en-us/articles/24037833895831-Get-started-with-Apple-s-UI-kit . Do not mirror entire Sketch/Figma binaries into a public repository without explicit redistribution permission.
2. **Apple SF Pro / SF Compact / SF Mono fonts:** licensing is restricted. Download/view only according to Apple's terms at https://developer.apple.com/fonts/ . Do not commit font files and do not bundle or self-host them on a cross-platform web app. This sample uses a system font stack, with the locally available OS font selected by the browser.
3. **SF Symbols:** consult the license delivered with the tool/download; do not export and embed Apple SF Symbols as a generic web icon pack. For Impulse web, use independently licensed Lucide icon equivalents after checking licenses and semantic meaning. No Apple product glyph is included here.
4. **Screenshots from Apple apps and proprietary design-kit exports:** links to original sources only; no screenshot copies are committed. Preserve source attribution for internal capture and obtain usage rights before republication.
5. **Apple names, logos, native controls and services:** this folder documents design references, not Apple affiliation, endorsements, Apple Pay, Apple Sign In, Wallet credentials or certified HIG conformance.
6. **Third-party Figma kits:** license separately, do not misattribute as Apple. iOS 16 community kit is a different source and should not silently override official iOS/iPadOS 27.
7. **This folder's HTML, CSS, JS, markdown and proposed JSON tokens:** original Impulse-oriented educational implementation that can be revised independently; it is not a native UIKit SDK, not a canonical Apple asset dump.

**Review gates:** legal review for redistributed third-party content; technical review for source measurements and appropriate licenses; accessibility review before integration. If a component requires Apple's actual bitmaps/animations or native compositor, mark it `NATIVE_ONLY` rather than claim 1:1 pixel equivalence in the browser.

The source's original visual appearance is intended as a **reference**; imitating Apple branding/identity in Impulse is not a prerequisite for adopting its information hierarchy, motion principles or material-layer logic.
