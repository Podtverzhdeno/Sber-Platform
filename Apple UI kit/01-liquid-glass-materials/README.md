# Liquid Glass / Standard Materials

**Status:** official reference page linked; exact Apple 27 editable components / per-frame measurements **PENDING**. These pages form a scoped reference packet, not a verified pixel-perfect reconstruction.

## Verified source entry

- Official Apple reference: https://developer.apple.com/design/human-interface-guidelines/materials
- Canonical current official design kits: https://developer.apple.com/design/resources/
- Relevant platforms: macOS 27 + iOS/iPadOS 27
- Original editable kits must be accessed in the appropriate Sketch/Figma tool under their licenses. No Apple-owned design binaries stored here.

## Study scope

- toolbar, glass button, glass panel, clear/regular, standard content surface

## Recommended transfer into Impulse

- Topbar, role drawer, notification and avatar popover

## Record variants / states

- regular vs clear
- light vs dark
- rich backdrop
- blur unsupported
- high contrast
- reduced transparency

## Reject these mistakes

- Glass content card everywhere
- transparent text over bright image
- implying CSS recreates native refraction

## Source-to-code record to complete

| Field | Status |
|---|---|
| Exact Apple Figma/Sketch frame ID | PENDING_SOURCE_ACCESS |
| Apple OS kit / component variant | macOS 27 + iOS/iPadOS 27 |
| Official source entry | https://developer.apple.com/design/human-interface-guidelines/materials |
| Light/dark source exports | PENDING_EXPORT |
| Measured geometry/type/color/opacity | PENDING_MEASUREMENT |
| Adaptation in React/TypeScript | NOT_INTEGRATED |
| Pixel overlay/diff | NOT_TESTED |
| Keyboard/ARIA/E2E test | NOT_TESTED |
| Original preview if supplied | **Independently drawn study SVG, not Apple screenshot** |

See `../PIXEL_PARITY_QA.md` for capture/measurement/QA and `../PROVENANCE_AND_LICENSE.md` for Apple copyrights and licensing. Existing Impulse owner-approved layout supersedes a generic kit layout when the two conflict.
