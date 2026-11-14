# Navigation overlay v4 — approved owner direction (2026-11-14)

**Supersedes:** the earlier design assumption of a permanently visible 244px desktop sidebar. The owner explicitly requested the panel be **hidden by default**, with a pleasant subtle appearing animation and a translucent background, to maximize space across every Impulse section. This behavior now applies to all six roles and all 49 server-authorized routes, including customer demo.

## Layering / content space

- Normal workspace (all widths): **full available canvas**, with no reserved nav column. The page title, search/toolbar, tab, table, form and dialog remain as implemented; adding a drawer does not remove them or change URLs or permissions.
- Top-left fixed **Меню** button, minimum 44px with text label and keyboard focus. Toolbar begins to its right; mobile keeps search below header where needed.
- Menu on request: overlay **320px wide or viewport minus 28px**, anchored to the left, not a grid column; short staggered row entrance, slight horizontal slide/opacity/scale. Main content must not jump.
- Floating panel: translucent `--color-sidebar` at ~94% opacity over a blurred backdrop; readable text remains opaque (no blur applied to actual text), soft neutral shadow, round right-side corners, concise two-level grouping.
- Scrim: dark neutral 23% in light, 42% in dark, `backdrop-filter: blur(6px)`, opaque enough to communicate focus but without obstructing panel text. Opening and closing both transition; backdrop stays mounted in DOM non-interactive while closed.
- Timings: panel 300ms gentle ease-out, scrim ~220ms, sub-items 250ms with 25–85ms staggering. Absolutely no mandatory bouncing, glowing animations or continuous movement. Reduced motion disables entrance/exit animations.

## Interaction, keyboard and role behavior

1. Menu **closed on first load on desktop and mobile**; `aria-expanded=false`; panel hidden/untabbable; underlying page usable at full width.
2. Click menu opens **one labelled modal drawer**, focus moves to its Close button, body scrolling temporarily locked; Tab/Shift+Tab stays inside, Escape closes and returns focus to menu button.
3. Click backdrop or Close closes with fade and focus return. Do not close on internal group disclosure changes.
4. Click any authorized link closes and navigates to the original `/workspace/:index`, preserving domain query/role context; current group's visible selected state is maintained on reopening.
5. The role chooser only displays assigned roles and retains permission semantics; changing role closes the drawer.
6. CSS-driven closing must preserve the ease-out animation, but closed links cannot be read/clicked by keyboard and screen readers (visibility hidden after transition).
7. `Светлая`, `Тёмная`, `Как в системе` uses the same existing preference; panel's translucent surface is contrasted and independently styled in both themes.
8. Menu remains discoverable at viewport 320/390/768/1024/1440/1920 and 200% zoom; no horizontal page scroll or occluded critical action.

## Quality / no-go

- Unit: menu open, backdrop click, Esc and focus, exact permissions/navigation grouping.
- E2E: 49 original role destinations, 320/390/768/960/1024/1440, initial full-width, no page shift on menu open/close, expected focus, contrast and two themes.
- Browser screenshot review: overlay foreground on white/light and graphite/dark; compare against user-original U01–U04 for depth/softness, **not** the mistakenly identified assistant-generated preview dimensions.
- Do not claim the entire 49-screen visual redesign is accepted until the existing E2E and cross-role screenshots pass; this PR is an implementation iteration under independent review.
