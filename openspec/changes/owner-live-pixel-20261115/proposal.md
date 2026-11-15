# Owner-directed actual Impulse Liquid Glass release

## Problem
Railway successfully deployed commits containing an isolated pixel dashboard but the user still saw the *old* authenticated header and the "Меню" button, because the new components had not been mounted in `App.tsx`. The user supplied a 1422×803 dark-blue screenshot with one floating translucent header, no visible Menu button, theme Sun/Blue Moon/Dark Moon, authenticated search/streak/bell/avatar and a two-card current-module/trajectory hero.

## Proposal
- Mount `OwnerPixelHome` as the **actual default participant root workspace**, using the same authenticated `development-overview`, role-level, learning-summary and passport APIs already in Impulse.
- Render only **one** authenticated floating glass toolbar globally for all six roles.
- Remove the visual "Меню" trigger entirely; the Impulse brand opens the same existing authorized sidebar, with left-edge hover retained and keyboard/mobile brand access.
- Move help, ranking, profile and signout into a small account popover; keep real search, streak and unread notification behaviors.
- Persist exactly three theme icon states: light Sun, blue Moon, dark MoonStar; preserve legacy light/dark CSS compatibility.
- Keep reversibility with `?home=legacy` and `?v2=0` for the previous participant homepage.
- No backend, data or permission changes.

## Coordination
Direct owner request 2026-11-15 for actual Railway version, not a standalone HTML. Earlier App/Sidebar claims last heartbeat 2026-11-14, no local App dirty changes, code edited on a new isolated GitHub branch; independent review and exact-SHA CI required before merge. Production rollback is the last known-good deployment SHA `013859d3`.

## Sources
User-approved 1422×803 screenshot `image(3).png`, official macOS 27 Apple Design Resources (https://developer.apple.com/design/resources/) and Apple HIG Materials (https://developer.apple.com/design/human-interface-guidelines/materials). Original blue wave WebP was previously merged as `/impulse-wave-reference.webp`.
