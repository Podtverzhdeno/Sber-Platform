# Pixel overlay comparison — operation manual

**This workflow is only for lawful, locally held reference images.** Do not commit original Apple Design Resource screenshots, imported Figma components, exported SF Symbols or derivative pixel overlays to a public repository.

## Procedure

1. Open the official Figma or Sketch Apple 27 UI Kit on your own account and read the current license. Note frame name, device, appearance, UI state and source URL.
2. Confirm you have permission for the local reference use. Take/reference a screenshot **locally only** and place it in \`Apple UI kit/_local-reference/source.png\`.
3. Capture the corresponding self-authored IMPULSE web UI as \`Apple UI kit/_local-reference/impulse.png\`, at exactly the same **pixel dimensions**, zoom level and appearance.
4. Run:
   \`\`\`bash
   python -m pip install Pillow
   python "Apple UI kit/04-web-reference/compare-screenshots.py" \
     --reference "Apple UI kit/_local-reference/source.png" \
     --candidate "Apple UI kit/_local-reference/impulse.png"
   \`\`\`
5. Open local \`_local-output/overlay.png\` and \`difference.png\`, inspect large mismatches, record numerical findings **without committing Apple content**.
6. Repeat for hover, pressed, selected, disabled, dark/light, mobile/tablet/desktop and long text.

## Interpretation

- Mean Absolute RGB Error (MAE, 0..255) shows average channel mismatch; lower means closer in raw pixels.
- Changed fraction shows the percentage where the **maximum per-channel difference** exceeds \`--threshold\` (default 20/255).
- Glass effects, native font rasterization, device scale, image noise and anti-aliasing can make MAE high even for visually similar UIs. Metrics are diagnostics, **not an automatic pixel-perfect acceptance threshold**.
- **Never resize a reference screenshot automatically** to match a candidate; mismatched geometry is a real problem to fix.
- The generated overlay contains both source images and is also not appropriate to publish if the source is Apple restricted.
- CSS approximations cannot physically replicate Apple native Liquid Glass.

## Exclusions

This tool does not check accessibility, semantics, app behavior, the licensing of screenshots or source availability. Pair it with \`03-impulse/visual-qa-checklist.md\` and manual design review.
