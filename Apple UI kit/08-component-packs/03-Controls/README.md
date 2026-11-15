# 03 · Controls and their states

**Sources:** [HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [HIG Menus](https://developer.apple.com/design/human-interface-guidelines/menus), [Apple Design Resources](https://developer.apple.com/design/resources/), [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass).

## Inventory / audit matrix
| Component | Required variants | Browser-equivalent semantic element | Use in Impulse |
|---|---|---|---|
| Button | primary, secondary, quiet, destructive, icon, loading, disabled | `<button>` | all actions |
| Button group | single/attached and mixed states | grouped buttons with labels | toolbars |
| Segmented picker | 2–4 choices; selected & focus | buttons with `aria-pressed`, or radios | views |
| Toggle | on, off, disabled, reduced motion | checkbox `role=switch` only when correct | preferences |
| Checkbox | on, off, mixed, disabled | native input checkbox | forms |
| Radio | one selected, disabled, keyboard arrows | native radio group | forms |
| Slider | min/max, current value, disabled | range input | preferences |
| Stepper | min/max, decrement/increment | buttons+number input | quantities |
| Menu action | open, hover, keyboard, destructive | menu/menuitem **with keyboard logic** | context actions |
| Popover | anchored, auto positioning, Escape, outside-click | dialog/popover with focus discipline | utility menus |

## What to measure from Apple UI Kit
Control frame, content edge insets, title baseline, icon size/weight, capsule radius, shadow, hover/press delta, glyph alignment, disabled alpha, focus ring, pointer and touch target. Store actual measurements per platform and state rather than guessing.

## Security/UX for Impulse
- No decorative fake buttons. Destructive controls must preserve existing confirmation and authorization checks.
- Keep keyboard focus visible and accessible names for icon-only actions.
- Async state means **server pending until confirmed**, not automatic success.
- Default, hover, active, focus-visible, selected, disabled, loading and error are all separate acceptance screenshots.

See [interactive examples](../gallery.html#buttons). These are original examples, **not** native Apple control renders.
