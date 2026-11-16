# AI-Buddy light theme: actual messaging route (2026-11-16)

References: local `Apple UI kit/06-cases/03-messaging/README.md`, `04-inputs-and-controls`, `07-mobile-adaptive`; Apple HIG Messages / Buttons / Layout.

**Root issue.** `buddy-chat-v2.scss` changed only parent colors in light mode. On a light sidebar, the section heading was still `#fff`; inactive history messages, all prompts, the hero and composer retained hard-coded dark surfaces and near-white text. This is low contrast and inconsistent with the app's Apple-calm language.

**Scope.** CSS-only `:root[data-theme="light"] .buddy-page .buddy2`: opaque sidebar, readable headings/empty state/history, pale prompt/list/cards, neutralized hero, legible real chat and light composer, 44px mobile controls. Dark and blue stay unchanged. The user's AI messages, APIs, privacy, read-only live evidence, abort buttons, file actions and keyboard interaction are untouched. No fake data is added.

**Acceptance.** 9 Chromium scenarios = 3 theme modes × 320/390/1440. Check computed backgrounds, primary label WCAG AA, hero close and compose availability, no horizontal overflow, theme isolation. Source-backed fixtures for profile, learning, ranking and analytics. Use isolated port, no traces. These are web approximations guided by Apple HIG, not pixel-claims of proprietary UIKit.
