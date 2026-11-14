# Apple-inspired Web UI for Impulse

## Objective
Adopt a coherent, minimal desktop-first Apple-like design language throughout Impulse without replacing its workflows, business states, API projections, accessibility affordances, or role permissions.

## Sources
1. Apple UIKit documentation: https://developer.apple.com/documentation/uikit
2. Apple Human Interface Guidelines: buttons, sidebars, toolbars, color, typography, controls and layout.
3. User-provided Figma iOS 16 community kit (node 1002:6668); link could not be inspected directly in this environment. Do not claim pixel parity.
4. User-provided Sketch reference documents: Wallet, TipKit, Live Activities, Messages, Apple Pay, App Intents & Shortcuts; native files inspected as Sketch ZIP metadata and previews. tvOS/visionOS DMGs are platform-specific references and were not imported into the web application.

## Non-goals
- Literal embedding of UIKit, which is native iOS software.
- Redistribution of Apple's reserved system font files, trademarked Apple product art or raw Sketch component packs.
- Changing navigation paths, server contracts, scoring logic, course-completion state, role access, or workflow outcomes.
- A cosmetic global selector that hides actions or suppresses permission/error states.

## Approach
1. Introduce a semantic, theme-aware token layer with dark/light support and native system font stack.
2. Restyle shared shell (side navigation, top utility bar, global search, drawers) and common controls (buttons, fields, tables, cards, badges, segmented controls, dialogs) in one late-imported stylesheet.
3. Map every role/section to a screen-specific composition; leave existing functionality intact.
4. Visual QA and usability tests at 1440×900, 1024×768, 390×844, keyboard navigation, high zoom, light/dark and reduced motion.
5. Gradually replace feature-specific hardcoded styling rather than claiming one cascade layer achieves pixel-perfect parity.

## Delivery safety
Feature work happens on a PR branch. No main merge or Railway deployment until independent review, CI, visual screenshots and mainline integration approval.
