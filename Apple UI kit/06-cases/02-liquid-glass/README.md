<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 02 — Liquid Glass / materials

**Target:** global shell / floating actions only (not card backgrounds).  
**Official refs:** [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass), [iOS 27 Figma](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27), [macOS 27 Figma](https://www.figma.com/community/file/1651309434229735362/macos-27).

## Cases

1. Regular glass overlay on neutral content — toolbar/sidebar, dark and light appearance.
2. Regular glass overlay on colorful/image content — ensure contrast at every scroll position.
3. Clear glass **only** over visually rich media — preserve underlying image; add dimming for bright content if required.
4. Thick opaque standard material in content layer — card/table/long-form reading.
5. Reduced transparency — immediate switch to readable solid surface, no blur.
6. High contrast/forced colors — distinguish edges/focus without relying on blur.

## Optical behavior checklist

- Native Apple glass uses system dynamic, refraction, luminance and interaction; CSS imitation (`backdrop-filter`, gradient borders, box-shadow) cannot promise exact optical rendering.
- Never apply a blur to every card (contradicts HIG); avoid recursively nesting translucent functional surfaces.
- Respect OS setting `prefers-reduced-motion`; `prefers-reduced-transparency` where browser supports; forced colors.
- Measure in a browser on actual rich background + during scroll; watch performance and text contrast.
- For **Clear** on bright imagery Apple suggests considering ~35% dark dim layer — contextual guidance, not a universal rule.

## Record in screenshot QA

Content backdrop, theme, opacity fallback, blur fallback, scroll frame, GPU/browser used, screenshot at exact scale, contrast result.
