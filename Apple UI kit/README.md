# Apple UI kit — source-backed UI reference library for Impulse

> Checked 2026-11-15. Apple® is the source of the linked design references, **not** the author or sponsor of this repository. This folder is an original, independently maintained *web adaptation guide*, not an Apple-distributed kit.

## Purpose

Make Apple design references **findable, measurable, and reproducible** in the React + TypeScript + Vite Impulse product without changing current routes, state, APIs, business semantics or six-role RBAC. All files under this directory are isolated reference/source material: importing them into the running app requires a separate integration task and review.

**Source hierarchy:** official downloadable Figma/Sketch UI kits → Apple Human Interface Guidelines → native implementation documentation → measured reference screenshot at a fixed viewport → this folder's web approximation. Never reverse that order or claim that a browser blur filter is Apple's actual rendering engine.

## Visual-first: browse the references

- [**Visual gallery (local HTML)**](reference-gallery.html): 13 independently drawn SVG case studies + 5 remote Apple-hosted official thumbnails. Open the file from a checked-out repository to view the gallery.
- [**Official Apple thumbnails (GitHub preview)**](OFFICIAL_VISUAL_GALLERY.md): actual preview imagery from Apple's iOS 27/macOS 27 kits and Messages/TipKit/Live Activities, linked to Apple servers, not redistributed.
- [**13 categorized reference folders**](REFERENCE_GALLERY.md): per-case source and state checklist, web study SVG and machine-readable provenance.
- [**Automatic consistency verifier**](scripts/verify_reference_pack.py): run `python "Apple UI kit/scripts/verify_reference_pack.py"` from the repository root.

The Apple-hosted thumbnails are real Apple previews but **not editable layer measurements**; the local SVG boards are original illustrations, not screenshots of Apple's apps. Do not confuse them.

## Start here

1. [Official source register](SOURCES.md): direct iOS/iPadOS 27, macOS 27, watchOS, visionOS design files and Apple component guidelines.
2. [Provenance and license](PROVENANCE_AND_LICENSE.md): use the links to obtain originals under their licenses; *no proprietary font, SF Symbols export, Apple design archive or screenshot has been copied into this repo*.
3. [Liquid Glass anatomy](LIQUID_GLASS.md): distinguish floating controls/navigation from standard content surfaces, light/dark and accessibility.
4. [Component atlas](COMPONENT_ATLAS.md): controls, navigation, dialogs, tables, lists, messaging, forms, states and hierarchy.
5. [Impulse mapping](IMPULSE_MAPPING.md): current frontend paths, role-specific screen families, migration boundaries.
6. [Browser study sample](web-prototype/index.html): source-only, standalone interactive HTML/CSS/JS preview (no dependencies; **not** production app and not an Apple pixel reference).
7. [Design token seed](design-tokens.json) and [component coverage matrix](component-coverage.csv): example values for web implementation, **not measured official Apple token values**.
8. [Pixel-fidelity acceptance plan](PIXEL_PARITY_QA.md) and [integration handoff](AGENT_HANDOFF.md).

## What 1:1 means

- For an **Apple source frame**, obtain and inspect the official editable kit, export the exact component variant/state at its design scale, measure all boxes/type/borders/shadows/colors and retain screenshot provenance. Verify in Figma/Sketch first.
- For an **Impulse screen**, compare at the same viewport, device scale, font availability, theme, data fixtures and accessibility options. Attach before/after/overlay/diff images and interaction results.
- Visual similarity does **not** imply identical behavior to UIKit, AppKit or SwiftUI; React/CSS cannot directly import the native Liquid Glass compositor, native navigation semantics or platform font/SF Symbol licenses.
- The acceptance gate must cover **behavior and data** as well as pixels. Do not replace real API values, role restrictions, existing keyboard controls or accessibility with a static screenshot.

## Scope and existing integration

Source repository: [Podtverzhdeno/Sber-Platform](https://github.com/Podtverzhdeno/Sber-Platform). Current Apple-inspired app CSS already exists at `frontend/src/app/apple-web-ui.scss`; related source and interface projects are in `openspec/changes/apple-web-design-system-20261114/` and `openspec/changes/impulse-apple-app-experience-20261114/`. Pixel reference in `docs/design/impulse-pixel-reference-20261114.md`. **Do not overwrite these or edit `frontend/src/App.tsx` without an exclusive integration claim.** Existing parallel agent scopes are active.

The “reference preview” in this folder deliberately uses original generic labels and CSS primitives rather than redistributing Apple screenshots. The authoritative unmodified visual material remains at the links below. Figma pages may need Figma access; this environment did not inspect individual layers of the 27 kits.

## Completeness

Coverage includes foundations (color, material, layout, typography, symbols, motion, accessibility), navigation, controls, data display, overlays, messaging, authentication, native-platform variants and web adaption. It is an indexed *representative comprehensive set*—not a claim that every Apple component and every state has been exported, inspected or pixel-verified. Expand the matrix as official design files are inspected and measured.
