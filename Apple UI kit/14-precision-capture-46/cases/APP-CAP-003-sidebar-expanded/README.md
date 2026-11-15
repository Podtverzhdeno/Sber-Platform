# APP-CAP-003 · Sidebar expanded

> **Status:** MEASUREMENT_PENDING · Apple visual source is linked, **not layer-inspected**. This is a capture/implementation contract, not an official Apple UI-kit export.

## Provenance

- Apple HIG: https://developer.apple.com/design/human-interface-guidelines/sidebars
- Official iOS/iPadOS/macOS 27 Figma/Sketch entry: https://developer.apple.com/design/resources/
- Figma/Sketch document version, exact component ID, source node and exported image SHA-256: **UNKNOWN (to measure)**.
- No Apple font, SF Symbol artwork or proprietary template file is included.

## Appearance states to measure

- [ ] light + dark
- [ ] desktop 1440px
- [ ] mobile 390px
- [ ] expanded + collapsed or scroll-adapted
- [ ] keyboard focus and Escape where applicable

**Geometry checklist:** outer bounds; toolbar/sidebar insets; sticky offset; translucent area; safe-area margin; icon and label alignment. Capture x/y/w/h, point-to-pixel scale, theme, zoom, font metrics, radius, shadow, alpha and any unsupported native material behavior; keep unknowns blank.

## Impulse mapping and behavior

**Target:** role-aware header, menu and local navigation.

Keep the product owner's hidden-at-rest menu and every role-permitted route; no replacement with unrelated navigation.

## 1:1 evidence gate

- [ ] Exact licensed source frame/version and all variants identified
- [ ] Source measurements and permitted screenshot export with hash recorded
- [ ] Local React/web rendering at the same viewport/device scale/font context
- [ ] Screenshot overlay + perceptual diff; native-only deviations documented
- [ ] Keyboard/touch/contrast, six-role permissions and API-data regression
- [ ] Independent visual reviewer approval linked to exact Impulse commit SHA

**Measured official geometry:** NONE · **Pixel-parity certificate:** NOT_CLAIMED
