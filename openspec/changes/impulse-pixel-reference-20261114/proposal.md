# Pixel-accurate Impulse dashboard reference

## Problem
User supplied a concrete 1422×803 screenshot (image(3).png) and requires the Impulse interface to match it rather than interpret it loosely. The upper floating toolbar shall show logo, search, click-cycling 3-mode theme, streak, notifications and user avatar. The hamburger Menu label is absent. The underlying full navigation must remain available.

## Scope
- Build a data-bound reference component in an isolated folder with callbacks for **all** actions and a 3-state palette.
- Include an original generated translucent blue arc wallpaper asset under frontend/public.
- Preserve server-owned level, module, grades, skills, tasks, search results, notifications and auth; no made-up production figures.
- Provide exact geometry evidence based on 1422×803 reference; source-inspired not exact proprietary macOS UI kit code.
- Provide a tested, independent interactive HTML preview for product acceptance.

## Coordination
Shared files `App.tsx`, theme controls, sidebar and `calm-home` are actively claimed by other workers. This PR is the complete **unmounted integration-ready reference** and must be wired by a nonconflicting integration owner after the relevant claim is released or explicitly transferred. It shall not override those shared files or claim an online deployment.

## Reference resources
- User's image(3).png: fixed screenshot reference.
- Apple Developer Design Resources, macOS 27 Figma/Sketch UI Kit: https://developer.apple.com/design/resources/
- Apple Materials / Liquid Glass HIG: https://developer.apple.com/design/human-interface-guidelines/materials
- The background is an original newly generated abstract image, not an Apple icon or wallpaper.
