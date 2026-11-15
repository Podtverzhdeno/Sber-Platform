# Liquid Glass — reference anatomy and implementation contract

**Official baseline:** https://developer.apple.com/design/human-interface-guidelines/materials , https://developer.apple.com/design/human-interface-guidelines/color , https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass .

## Core layer model

```text
Layer 3 — transient action overlays: menus, popovers, dialog controls
Layer 2 — floating navigation & interactive chrome: toolbar, search, sidebar, tabs
Layer 1 — content: course cards, evidence, projects, forms, messages, tables
Layer 0 — page/window background: light/dark canvas, image or art where appropriate
```

Apple distinguishes **Liquid Glass** (Layer 2 controls/navigation) from **standard materials** (Layer 1 content). Do **not** put refractive “glass” over every content card or data row. Only transient controls within content, such as active sliders/toggles, may warrant glass emphasis. Overuse harms hierarchy and readability.

## Native behavior to study in the official kits

| Attribute | What to inspect in Figma/Sketch | Web mapping / caveat |
|---|---|---|
| Transparent environment sampling | Foreground contrast against a varying background | `backdrop-filter` + adaptive tint; **not native refraction** |
| Shape and edge treatment | Capsule/circle/radius, inner highlight, subtle stroke | Border radius, gradient/highlight pseudo-element; measure per source |
| Clear vs regular | Opacity, bright/dark backdrop, label legibility | `data-glass=clear|regular`; CSS variants are approximate |
| Glass tint | Only important actions are colored | Tokenized accent; one prominent CTA per group |
| Morphing/merging | Adjacent glass controls animated as one native layer | Discrete CSS transition only; do not call it identical to GlassEffectContainer |
| Dynamically adaptive foreground | Text/icons switch for legibility | Semantic tokens, light/dark + contrast test |
| Overlay/scroll extension | Toolbar floats above scrolling content | Sticky topbar, blur fallback, avoid clipping content |
| Press/hover/focus | State-dependent surface+content feedback | :hover, :active, :focus-visible, ARIA, real pointer/keyboard |
| Reduced transparency | Opaque fallback where needed | `prefers-reduced-transparency` where supported, plus forced-color/unsupported-blur fallbacks |
| Motion reduction | No distracting morph | `prefers-reduced-motion` |
| Native rendering | Compositor, vibrancy, interaction physics | **NATIVE_ONLY**; CSS has unavoidable cross-browser differences |

## Apple-specific rules worth preserving

- Colors in glass generally originate from the content behind it. The glass is not simply a semi-transparent blue box; Apple advises restrained control tinting.
- Apple's materials guidance says a clear glass control over a *bright* image may benefit from ~35% dark dimming; decide case by case, **not** a blanket overlay on every element.
- Sidebar glass can be more opaque than compact buttons to maintain text legibility.
- Large content sections and details use standard backgrounds, not the highest blur level.
- Revisit color, size and layout in light, dark, high contrast, forced-colors, reduced motion and reduced transparency.

## Sample approximation (not official measurements)

The standalone `web-prototype/` contains `glass-toolbar`, `glass-button`, `glass-popover`, `surface-card`, `control-input` and `segmented-control`. They use proposed web values with semantic CSS properties. The **official Apple 27 Figma/Sketch kits remain the visual truth** and individual values must be replaced by measured ones when those source layers are opened.

## Impulse-specific integration

- Shared toolbar, role drawer, avatar, quick actions and short-lived menus are the initial Liquid Glass candidates.
- Participant skills, tasks, grades, certificates and tables remain readable **content** surfaces.
- For chat, treat toolbar/compose action chrome as controls; message bodies are *content*, not glass capsules by default.
- The owner's current overlay navigation choice must be preserved even when it differs from default native sidebar behavior.
- Never hardcode demo/mock data, replace human decisions or obscure restrictions behind visual effects.
