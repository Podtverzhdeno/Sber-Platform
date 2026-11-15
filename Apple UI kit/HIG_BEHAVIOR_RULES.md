# Source-backed Apple HIG behavior rules for Impulse web controls

**Research checkpoint:** 2026-11-15. This is a paraphrased interpretation of current Apple guidance for an independent browser UI; it is not native UIKit/AppKit behavior or an Apple-authored specification.

## 1. Material hierarchy
Source: https://developer.apple.com/design/human-interface-guidelines/materials

Liquid Glass belongs on navigation and control chrome (toolbars, tab bars, sidebar, contextual actions). Normal content, long reading views, form bodies, messages, dense tables and evidence use standard surfaces. Clear glass is suited for visually rich backdrops; bright backgrounds may require a dimmer for contrast. Apple provides regular and clear variants. Avoid excessive custom glass effects.

**Test**: 2 layers remain distinct; no blurred data cards; clear controls stay readable over bright + dark images; reduced transparency and forced colors have solid fallback.

## 2. Color is semantic, not uniformly blue
Source: https://developer.apple.com/design/human-interface-guidelines/color

Uncolored glass often adapts to the underlying environment. Reserve tinted material for truly prominent actions and statuses; color alone must never encode a grade, risk, review or visibility state.

**Test**: one accent CTA per action group; label and status semantics remain clear in light/dark/high-contrast.

## 3. Tab bars navigate; toolbars act
Sources: https://developer.apple.com/design/human-interface-guidelines/tab-bars and https://developer.apple.com/design/human-interface-guidelines/toolbars

Tabs represent destinations or major sections. Toolbars contain commands, navigation, search and current-view actions. In Impulse, role switching and global navigation must preserve authorized routes and not become a decorative segmented-control imitation.

**Test**: active tab maps to a real section; focused toolbar actions perform exactly what their labels state; keep overflow menus for infrequent commands.

## 4. Sidebar is a navigation structure
Source: https://developer.apple.com/design/human-interface-guidelines/sidebars

Sidebars take space, can float over content, and can adapt to compact layouts. **Owner-specific Impulse decision:** drawer is hidden by default, including desktop. This intentionally differs from some native patterns and must be preserved with an obvious trigger, accessible focus handling, and no hidden security status.

**Test**: closed drawer inert, never traps focus; open/close/Escape/outside correct; returning focus to launcher.

## 5. Search needs clear scope and responsive results
Source: https://developer.apple.com/design/human-interface-guidelines/search-fields

Search can be a dedicated tab, a toolbar field or an inline field based on the task. Filtering should respond promptly and offer suggestions, a clean no-results state, and clear scope.

**Test**: show real source-backed API results, allow clearing text, distinguish no-results from permission denial, preserve search semantics when resizing.

## 6. Popovers are transient and small
Source: https://developer.apple.com/design/human-interface-guidelines/popovers

Use popovers for brief contextual tasks, not for long forms. Avoid cascading multiple popovers. On narrow mobile use an appropriate sheet/full-screen treatment when needed. Do not discard partially edited work simply because the user clicked outside.

**Test**: popover keyboard and outside dismissal, one active panel, no unreviewed save, focus restoration.

## 7. Controls and sheets maintain clear action semantics
Sources: https://developer.apple.com/design/human-interface-guidelines/buttons and https://developer.apple.com/design/human-interface-guidelines/sheets

Prominent vs secondary and destructive buttons must be distinguishable, labeled and accessible. Sheets are short interruptions; protected confirmation and consent must remain visible and authentic.

**Test**: no real approval or financial action hidden behind a cosmetic success animation; review and payment decisions remain human/domain governed.

## Limits

This document does **not** provide a 1:1 Apple CSS implementation or per-component numerical metrics. Current official editable kit versions are reachable via https://developer.apple.com/design/resources/; real layer export and measurement remain outstanding.
