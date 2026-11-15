# Official Apple editable design sources — indexed, not redistributed

**Checked 15 November 2026.** Each direct Figma/Sketch URL below was obtained by following its **actual link on [Apple Design Resources](https://developer.apple.com/design/resources/)**. Some Figma pages were blocked from crawler inspection and some Sketch pages had redirect errors. Therefore link *listing* is confirmed, but document availability, editable component layers, version metadata, licensed export and pixel metrics are **not** claimed.

The companion [JSON source register](OFFICIAL_EDITABLE_SOURCES_2026.json) is suitable for task selection and future frame-by-frame capture. These are actual third-party design-tool URLs **listed by Apple**, not generated placeholders.

| Official resource | Figma | Sketch | Impulse study area |
|---|---|---|---|
| iOS & iPadOS 27 UI Kit | [Officially listed Figma](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27) | [Officially listed Sketch](https://www.sketch.com/s/04c24d8b-38fb-4afb-8836-36617e022f02) | [01-liquid-glass-materials](01-liquid-glass-materials/README.md) |
| macOS 27 UI Kit | [Officially listed Figma](https://www.figma.com/community/file/1651309434229735362/macos-27) | [Officially listed Sketch](https://www.sketch.com/s/57153a31-3379-4737-8ac6-dbfd6525f052) | [02-navigation-sidebars-tabs](02-navigation-sidebars-tabs/README.md) |
| watchOS 26 UI Kit | [Officially listed Figma](https://www.figma.com/community/file/1540060090060216489/watchos-26) | [Officially listed Sketch](https://www.sketch.com/s/2b12618d-596c-41fd-8488-132bff9535e7) | [12-native-platform-kits](12-native-platform-kits/README.md) |
| visionOS 26 UI Kit | [Officially listed Figma](https://www.figma.com/community/file/1540071341298017505/visionos-26) | [Officially listed Sketch](https://www.sketch.com/s/eb13bfe1-2ddb-4f87-b92c-740a36abed7a) | [12-native-platform-kits](12-native-platform-kits/README.md) |
| App Icon Template 27 | [Officially listed Figma](https://www.figma.com/community/file/1645923469870515372/app-icon-template-ios-ipados-and-watchos-27) | [Officially listed Sketch](https://www.sketch.com/s/a443d962-d989-4c5b-b1db-fb7fb3946995) | [08-typography-colors-symbols](08-typography-colors-symbols/README.md) |
| Live Activities Template | [Officially listed Figma](https://www.figma.com/community/file/1367915437752334285/live-activities) | [Officially listed Sketch](https://www.sketch.com/s/d1e8992f-14c2-4eef-b29d-24a32c0c0ef9) | [09-progress-feedback-states](09-progress-feedback-states/README.md) |
| Messages Template | [Officially listed Figma](https://www.figma.com/community/file/1367916269438172112/imessage-apps-and-stickers) | [Officially listed Sketch](https://www.sketch.com/s/d6cd3d23-7aec-43d5-acb9-52f720ff48b7) | [07-messages-collaboration](07-messages-collaboration/README.md) |
| TipKit Template | [Officially listed Figma](https://www.figma.com/community/file/1367917705471226837/tipkit) | [Officially listed Sketch](https://www.sketch.com/s/b99f22e1-235e-481b-9ccd-aa7d8f31fedc) | [05-menus-popovers-sheets](05-menus-popovers-sheets/README.md) |
| Wallet Template | [Officially listed Figma](https://www.figma.com/community/file/1367917956770293718/wallet) | [Officially listed Sketch](https://www.sketch.com/s/dd2ce40a-097e-486b-9053-b60088e1d6c3) | [10-portfolio-wallet-identity](10-portfolio-wallet-identity/README.md) |
| App Clips Design Template | [Officially listed Figma](https://www.figma.com/community/file/1367914571662801866/app-clips) | [Officially listed Sketch](https://www.sketch.com/s/e6ed1af0-508c-4fd5-bc6f-05f7ccb91c6e) | [12-native-platform-kits](12-native-platform-kits/README.md) |
| Apple Pay Design Template | [Officially listed Figma](https://www.figma.com/community/file/1367915141082663884/apple-pay) | [Officially listed Sketch](https://www.sketch.com/s/b0fa95e1-e12d-4694-895f-a70f39b8f313) | [05-menus-popovers-sheets](05-menus-popovers-sheets/README.md) |
| Sign in with Apple Buttons | [Officially listed Figma](https://www.figma.com/community/file/1367916685468040146/sign-in-with-apple) | [Officially listed Sketch](https://www.sketch.com/s/7cd7dbf4-41b2-4e90-bb00-2796ced3cf2b) | [03-buttons-and-selection](03-buttons-and-selection/README.md) |
| Siri and App Shortcuts Template | [Officially listed Figma](https://www.figma.com/community/file/1367916969551216595/siri-app-shortcuts) | [Officially listed Sketch](https://www.sketch.com/s/84ba051b-c6ad-48c5-8106-28185947754a) | [11-motion-accessibility-responsive](11-motion-accessibility-responsive/README.md) |
| Tap to Pay on iPhone Template | [Officially listed Figma](https://www.figma.com/community/file/1367917199004804052/tap-to-pay-on-iphone) | [Officially listed Sketch](https://www.sketch.com/s/fbd2fa90-fadd-403a-b319-0f4d7c04ae5f) | [05-menus-popovers-sheets](05-menus-popovers-sheets/README.md) |

## Reproduction protocol
1. Open the specific Apple-linked Figma or Sketch kit with the required account and accepted license.
2. Record the **exact** file revision, component/frame ID, light/dark, state, size, typography, strokes, blur/shadows and pixel export scale.
3. Keep original Apple assets in their licensed environment. Do **not** commit Apple Figma/Sketch binaries, fonts or proprietary screenshots to this repository.
4. Recreate a separate React/TypeScript analogue using semantic HTML, real Impulse API data, six-role permissions and existing navigation controls.
5. Run pixel overlay/difference against an **authorized** reference capture, in the same viewport/DPR and rendering environment. Confirm keyboard, touch, loading/error and reduced transparency states.

## Important distinctions
- *Messages Template* on Apple Resources targets **iMessage apps and stickers**; it is not a full copy of Apple's Messages app interface. Use Apple HIG and real Impulse messaging constraints for a product chat.
- Apple Pay, Sign in with Apple, Wallet, App Clips and Tap to Pay templates are brand/product integration-specific; do **not** imply these services are integrated into Impulse merely because the templates are indexed.
- watchOS and visionOS references offer interaction inspiration but do not define a drop-in web component implementation.
- Current browser CSS `backdrop-filter` cannot reproduce the native Liquid Glass compositor 1:1.
- This register tracks **14 resource pairs / 28 officially listed editable links**; the Apple Resource hub also has other download formats and templates not in this first focused editable-pair register.
