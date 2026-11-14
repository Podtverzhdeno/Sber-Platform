# CORRECTED: actual four user-uploaded visual references (2026-11-14)

**Source priority:** This document is based on the **exact four images directly uploaded by the user** in the conversation. It **SUPERSEDES** the inaccurate claim in `owner-screenshot-pixel-contract-20261114.md` that an assistant-generated Impulse preview pack consisted of these originals. The previous pack remains useful only as *assistant mockup* screenshots, **not user reference assets**. No existing preview hashes have been changed silently.

## Provenance and exact files

Original user files were re-opened and visually inspected directly, then archived unchanged as `impulse-user-original-ui-references-20261114.zip` with `manifest.json` (SHA-256). Persisted in the owner's ChatGPT personal Library under `/Impulse-UI-References-2026-11-14/impulse-USER-original-4-images.zip`, separately from the older assistant mockup `impulse-reference-pack-20261114.zip`.

| ID | Supplied content actually depicts | Dimensions | SHA-256 | Strength |
|---|---|---|---|---|
| U01 | **Soft neumorphic controls**, light cool-gray canvas: buttons, pill inputs, select, switches, vertical bar values, progress bar; electric-blue accent | 1000×750 | `c3c8ac8dfd74461ecd083d88a2adf1b0e12d2a43a22c99b1860e0485af5f4bb2` | Microinteractions, *optional* soft control treatment |
| U02 | **Two iPhone screen concepts**, bright white app: browse/search/highlights/list/action + account/settings grouped rows and toggles, bottom tab bar; pink surrounding poster background | 2048×1292 | `8c62740d3ae301896eb4070a097aa0f41ad3259141eecd696cb431ed794719ab` | Primary mobile content hierarchy, groups, rows, search, account; **pink is poster background**, not required app theme |
| U03 | **A Figma workspace screenshot displaying dark social UI kit comps**: black/charcoal cards, compact filters, messages, profile elements, purple accents; includes Figma editor chrome | 2048×1147 | `087056027f047a1656f7945b0cb74998bf6026cfdeef7b79c2d9303f9082c29f` | Dense dark-mode object surfaces / messages; **Figma editor chrome is not part of the app** |
| U04 | **Blue-toned iOS components/design collage**: sidebar-ish grouped rows, alerts, controls, segmented navigation, wheels, switches, icons; muted blue scene | 1500×914 | `f426d6ac0d45e18e1635678f047c5416ce4b004a924c3a0e54233ec83f5218f9` | Hierarchy of settings, compact contextual navigation, softened panels and segmented controls; no requirement for all-blue web background |

## Distinct design evidence and permitted inferences

### U01 controls (not a full real app layout)

**Observed:** generously rounded pills, near-monochrome surface, raised and inset soft shadow pairs, primary bright-blue states, switches and progress bar. It gives **no evidence** for sidebar dimensions, header height, content arrangement or page hierarchy. **Decision:** apply a *restrained* soft depth (subtle hover/button/inset progress track) to primary controls only, not every table/list/form. Full-app neumorphism harms contrast, is poor for disabled and dark states, and cannot prove "Apple official style."

### U02 white iOS app mockups (not Apple Support screenshots)

**Observed:** large heavy first heading, small muted subtitle/search, compact short named content groups, item rows with icon/title/detail and trailing action, inline settings toggles, balanced gutters, bottom navigation. **Decision:** mobile screen hierarchy and microcopy: title → search or one action → relevant group → item rows; secondary controls inside a named group. **Do not infer** Apple created or approves this third-party mockup; no claim to replicate this as a live Apple product.

### U03 dark Figma artboard

**Observed:** true dark content cards, muted text, compact visible statuses, chat threads, colored circles/images only where object identity requires, tight but readable spacing; the surrounding Figma toolbars/properties are editor scaffolding. **Decision:** dark theme is not an inverted light screenshot; use separately reviewed charcoal surfaces, lower-intensity blue/purple only for focus and authored media. **Do not copy** Figma product UI chrome or crowd every screen with tiny cards.

### U04 muted blue iOS collage

**Observed:** grouping by visual planes, readable larger header, segregated alert actions, segmented selections, calm row list and switches, softened separator lines. Some contrast is weak (white text on desaturated blue), and the image is a *showcase* rather than a usable app at 200% zoom. **Decision:** adopt grouping, tool adjacency and segmented controls where there are 2–4 local views. **Do not reproduce** low contrast, purely translucent text or blue entire surface.

## Style synthesis hierarchy

1. **Primary content architecture:** Apple HIG official `Design principles`, `Writing`, `Lists and tables`, `Split views` + user U02.
2. **Controls/detail:** U01 (small soft raised/inset effects) + U04 (quiet grouping, dialogs, tabs).
3. **Dark theme:** U03 true charcoal list/cards with high contrast + accessible semantic dark palette.
4. **Other visual research:** Linear 2026, iCloud Notes, Vercel Geist and Notion; these are third-party design patterns, not owner's exact screenshot source.
5. **Previous assistant-generated Impulse images A1/A2/B1/B2:** optional conceptual layout sketches **only**. Their 245px sidebar, 68px toolbar and 938×205px focus dimensions belong to assistant mockups, **not the user-uploaded four original images**. Never describe those dimensions as user supplied.

## Apple official verified implications (facts vs our proposals)

- Apple HIG principle "Simplicity isn't minimalism": keep what's important, allow others to recede. https://developer.apple.com/design/human-interface-guidelines/design-principles/
- Lists & tables favor scan-friendly text and show selected item detail separately. https://developer.apple.com/design/human-interface-guidelines/lists-and-tables/
- Sidebars should rarely exceed two depth levels. https://developer.apple.com/design/human-interface-guidelines/sidebars/
- Split view combines navigation/content/optional inspector; compact width requires adapted pattern. https://developer.apple.com/design/human-interface-guidelines/split-views/
- Liquid Glass belongs to *navigation/control* layer, not data/content layers. https://developer.apple.com/design/human-interface-guidelines/materials/
- Apple writing: short, action-first labels; informative empty/error states; visible next step. https://developer.apple.com/design/human-interface-guidelines/writing/

**Not official Apple facts:** these source images, our spacing and color tokens, route/feature hierarchy, KPI choices, badge styles and product behavior. These are Impulse design proposals to approve with actual browser screenshots.

## Constraints

- No direct pixel copying from unrelated copyrighted third-party app mockups. The intent is layout and interaction fidelity without distributing the images in product bundle.
- For user supplied files, measure pixel values of controls and screenshots only where that file actually contains the feature; do not extract a global desktop grid from mobile mockups.
- Text/role/metric data comes from authoritative existing Impulse APIs. User images contain unrelated social/retail example content.
- No code / no Railway deploy from this document. Implementation remains held pending owner design review.
