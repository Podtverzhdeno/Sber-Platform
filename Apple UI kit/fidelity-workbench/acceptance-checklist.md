# Pixel parity QA — checklist

## Source provenance

- [ ] Лицензия на Figma/Sketch source соблюдена; точная платформа и версия сохранены
- [ ] Exact frame, variant, selected state and screenshot timestamp recorded
- [ ] Reference screenshot was NOT redistributed if Apple terms prohibit it
- [ ] Target Impulse commit SHA, route, user role, fixture and build recorded

## Geometry and appearance

- [ ] Pixel dimensions A/B exactly equal, as are DPR, zoom and operating environment
- [ ] Theme, locale, font metrics, reduced-motion and transparency settings equal
- [ ] Divider 0/50/100 inspected at native pixels
- [ ] Generated heatmap PNG and JSON saved with tolerance specified
- [ ] Font baselines, radii, control padding, spacing, shadows, borders inspected
- [ ] Liquid Glass affects navigation/control layer; cards/tables use standard material
- [ ] 320, 390×844, 1024×768, 1422×803 and 1440×900 coverage separately reviewed
- [ ] Focus, active, disabled, error, loading, empty and dark/light states inspected
- [ ] Deviations listed with acceptance decision; no false 1:1 claim made

## Functional / accessibility

- [ ] Every active control has real event handler and user-visible feedback
- [ ] No data/permission/role fields replaced by decorative text or fake values
- [ ] WCAG 2.2 AA text contrast, focus and keyboard navigation reviewed
- [ ] Escape, outside click and focus return for overlays verified
- [ ] No horizontal overflow, clipped CTAs or 44px touch target failures
- [ ] Independent reviewer checked changed files and exact tested SHA
- [ ] Main integration and Railway release are separate approval-gated tasks

**Status:** this checklist is a template. Do not mark items complete solely from this folder's SVGs or conceptual studies.
