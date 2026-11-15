# APP-CAP-013 · Standard text button

> **Status:** MEASUREMENT_PENDING · Apple visual source is linked, **not layer-inspected**. This is a capture/implementation contract, not an official Apple UI-kit export.

## Provenance

- Apple HIG: https://developer.apple.com/design/human-interface-guidelines/buttons
- Official iOS/iPadOS/macOS 27 Figma/Sketch entry: https://developer.apple.com/design/resources/
- Figma/Sketch document version, exact component ID, source node and exported image SHA-256: **UNKNOWN (to measure)**.
- No Apple font, SF Symbol artwork or proprietary template file is included.

## Appearance states to measure

- [ ] default
- [ ] hover + pressed
- [ ] keyboard focus-visible
- [ ] disabled
- [ ] long Russian action label

**Geometry checklist:** tap target; radius; horizontal/vertical padding; type weight; icon/label gap; hover and press surfaces. Capture x/y/w/h, point-to-pixel scale, theme, zoom, font metrics, radius, shadow, alpha and any unsupported native material behavior; keep unknowns blank.

## Impulse mapping and behavior

**Target:** shared action controls.

No decorative inactive buttons posing as working actions; preserve actual asynchronous success/error states.

## 1:1 evidence gate

- [ ] Exact licensed source frame/version and all variants identified
- [ ] Source measurements and permitted screenshot export with hash recorded
- [ ] Local React/web rendering at the same viewport/device scale/font context
- [ ] Screenshot overlay + perceptual diff; native-only deviations documented
- [ ] Keyboard/touch/contrast, six-role permissions and API-data regression
- [ ] Independent visual reviewer approval linked to exact Impulse commit SHA

**Measured official geometry:** NONE · **Pixel-parity certificate:** NOT_CLAIMED
