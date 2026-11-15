# Local pixel comparator — capture and evidence workflow

**Reference tool:** [pixel-compare.html](pixel-compare.html) (fully local browser page; no network, accounts, Apple assets or external JavaScript). **Deterministic algorithm tests:** [test_pixel_compare.cjs](test_pixel_compare.cjs).

This is a visual QA utility for independently authored Impulse web controls, **not** a claim of Apple native Liquid Glass rendering or exact Figma/Sketch fidelity.

## 1. Prepare a legally usable reference

1. Find the specific reference in [Apple Design Resources](https://developer.apple.com/design/resources/) and the matching [46-case manifest](manifest.json).
2. Inspect the actual editable Apple design kit in Figma/Sketch under applicable terms. Record the source document revision, component/node ID, selected variant, theme, platform, design-tool export scale and rights to use the image.
3. Keep proprietary Apple exports outside GitHub; use licensed **local** captures or original owner-approved Impulse reference images in the comparison tool.
4. Use the same rendered state in the Impulse app and reference: width/height, OS/browser, device scale factor, font availability, locale, light/dark theme, accessibility preferences and data fixture. If the source is a native platform frame, explicitly record native-only differences.

## 2. Compare without sending private images

Open `pixel-compare.html` directly from a checked-out copy of this PR. Choose the local reference and local Impulse screenshot (PNG, JPEG, WebP; each up to 15 MB; up to 16 million decoded pixels). **Both must have identical pixel dimensions**; this tool intentionally does not resize or auto-align images.

The initial channel threshold is **16 (out of 255)** and can be set from 0 to 255. The detector marks a pixel as changed when **any** red, green, blue or alpha channel differs by more than the threshold. It also computes:

- **Changed pixels**: integer count, denominator = all pixels.
- **Changed ratio**: changed count / all pixel count.
- **RGBA MAE**: sum of absolute channel differences / (4 × all pixels), scale 0–255.
- **Heatmap**: red-highlighted changed pixels (no semantic region detection).
- **Split and 50% overlay**: visual aids, not a geometric registration tool.

Use the `Save JSON report` action and keep it with your local QA evidence. The JSON explicitly says `pixel_parity_certified: false`; a reviewer must separately inspect licensed source provenance, bounds, typography, states and behavioral correctness. This tool does not determine an acceptable numerical threshold or provide a WCAG audit.

## 3. Reviewer evidence schema (record next to local report)

```json
{
  "source": {
    "publisher": "Apple or Impulse owner",
    "kit": "iOS/iPadOS/macOS 27 or approved Impulse screenshot",
    "document_revision": null,
    "frame_node_id": null,
    "reference_image_local_sha256": null,
    "license_or_permission_checked": false
  },
  "impulse": {
    "commit_sha": null,
    "route": null,
    "role": null,
    "theme": null,
    "viewport_css_px": null,
    "device_scale_factor": null,
    "browser_and_version": null,
    "output_image_local_sha256": null
  },
  "comparison": {
    "local_json_report_path": null,
    "same_font_and_scale_verified": false,
    "documented_native_only_differences": [],
    "keyboard_pointer_touch_review": null,
    "reduced_motion_and_transparency_review": null
  },
  "reviewer": {
    "identity": null,
    "decision": "PENDING_INDEPENDENT_REVIEW",
    "accepted_1_to_1": false
  }
}
```

The null values are deliberate. **Do not fill with guessed Apple dimensions, invented screenshot hashes or fabricated reviewer approvals.**

## 4. Automated checks

With a checked-out copy of the repository:

```sh
python "Apple UI kit/14-precision-capture-46/verify.py"
node "Apple UI kit/14-precision-capture-46/test_pixel_compare.cjs"
python "Apple UI kit/14-precision-capture-46/qa_browser.py"
```

The optional browser script requires Playwright and installed Chromium; see [README](README.md) for install commands. QA screenshots remain untracked in `qa-output/`.

The tests for `pixel-compare.html` validate pixel-difference arithmetic and basic input guards. They do **not** prove the visual appearance or interaction of the entire current Impulse React app. Integration has its own exclusive claim, tests, review and release gates.

## 5. Interpretation examples

- **Different sizes**: comparison is rejected; fix viewport/export setup first.
- **0% pixels changed**: only means exact channel equivalence under the given files and threshold, not source authenticity or accessibility.
- **Unchanged displayed color but different alpha**: still counts as changed, by design. Compare the appropriate compositing or background assumptions.
- **Large MAE**: inspect offset, font rendering, antialiasing, locale and image export before changing unrelated app code.
- **High similarity but broken controls**: fails acceptance; navigation, focus, forms, real-data truth and role authorization must remain functional.

All Apple design/source documents remain linked rather than repackaged.
