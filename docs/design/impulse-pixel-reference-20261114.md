# Impulse pixel-design reference · 14 Nov 2026

**Source:** user-uploaded `image(3).png`, 1422×803; user explicitly selected the dark/navy Apple-like variant. Preserve its typography and negative space rather than switching to a newly invented dashboard layout.

**Official UI guidance:** Apple macOS 27 Sketch/Figma kit (https://developer.apple.com/design/resources/), Apple HIG Materials / Liquid Glass (https://developer.apple.com/design/human-interface-guidelines/materials). The latter explicitly uses glass in the navigation/control layer; this reference uses opaque and low-opacity card bodies so the text remains readable.

**Generated source:** original 1672×941 blue/navy abstract waves, downsampled to `frontend/public/impulse-wave-reference.webp` 640×360 (2,658 bytes) for the web. No Apple copyrighted background or SF fonts are bundled.

**Actual files:** `frontend/src/features/pixel-reference/ImpulsePixelReference.tsx` + `impulse-pixel-reference.scss` + test; all business interactions are declared as props. A self-contained local HTML acceptance reference was separately rendered in Chromium at 1422×803 and 390×844. Do not claim live app or Railway publishing from the reference alone.

**Measurements on headless Chromium mock (reference image compared by geometry):**
- floating toolbar (56,0) 1310×62
- hero (143,181.6) 792.6×252
- trajectory (956.6,181.6) 334.4×252
- metrics start y455.6
- next level start y540.6
- requirements/work/tools remain progressively disclosed
- 3-theme click and search/nav/requires interactions passed in standalone demo; all three theme screenshots generated

**Partial-fidelity caveats:** The source screenshot contains a rendered photographic avatar and a layered icon. The production view must use the authenticated user's real avatar/initials, not silently replace them with an invented identity. The new stack glyph is original CSS, not a copied Apple SVG.

**Open integration blockers:** main's `UI-APPLE-INTEGRATE-20261114` and `UI-ALL-APPLE-20261114` claims own App/theme-control/sidebar and `UI-CALM-HOME-20261114` owns the home component. This isolated branch does **not** change those files. No live app claim, full route screenshots or production rollout until integration reviewer takes the handoff.
