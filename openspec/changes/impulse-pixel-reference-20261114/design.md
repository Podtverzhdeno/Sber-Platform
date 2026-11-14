# Pixel fidelity design and integration

## Screenshot measurements
Reference screenshot `image(3).png`, natural size **1422×803**. Headline/hero geometry must be measured at browser deviceScaleFactor 1, viewport 1422×803.

| Component | Reference approximate bbox (CSS px) | Implemented reference geometry |
|---|---:|---:|
| Floating toolbar | x≈56, y0, w≈1310, h≈62 | width calc(100%-112px), height 62px, radius 0 0 23 23 |
| Content | x≈143..1291, top 94 | max width 1148px, left shift 6px |
| Headline | x≈149, y≈99 | 36px bold |
| Main module hero | x≈143,y≈181,w≈793,h≈252 | 2.37fr to 1fr responsive grid, 21px gap |
| Trajectory | x≈957,y≈181,w≈334,h≈252 | independent data-bound panel |
| Metric row | x≈149,y≈455 | 3 column flat row with dividing lines |
| Level progress | y≈540 onwards | native accessible progressbar |
| Week and tools | lower fold | controlled disclosure, no missing actions |

The generated wallpaper is `/impulse-wave-reference.webp`, 640×360 optimized WebP (2.7 kB), from an independently generated 1672×941 background. It contains no text, icons, UI controls or personal data.

## Three modes by click
- **sun / light**: high-contrast pale background, Sun icon.
- **blue moon / blue**: reference dark blue wallpaper with bright cyan/blue moon.
- **dark moon / midnight**: darker, quieter navy-black wallpaper and MoonStar icon.
Cycle: light→blue→midnight→light. This is an isolated future design contract; existing global `app/theme.ts` currently supports light/dark/system and is deliberately untouched until coordinator integration. Legacy system preference must have a migration/fallback defined at wiring time.

## Functional integrity
The reference `ImpulsePixelReference` has data-and-handler props. Real CTAs call `onContinue`, `onOpenJourney`, search routes use `onSearchSelect`, notifications use `onOpenNotifications`, profile has a toggle and optional logout/ranking/help actions, left brand opens navigation `onOpenNavigation`. Unknown progress is omitted. This is **not** a demo-only component with fabricated stats.

Pixel HTML preview has separate hardcoded *design example* data from the screenshot. Demo buttons explicitly report themselves as mock actions. Do not mistake those numbers for connected production data.

## Integration acceptance
1. Integrator checks active claims, then mounts the component through real App/auth/role-level and calm-home query callbacks.
2. Keep the existing hover-left edge Sidebar and explicit mobile navigation; brand button serves as accessible click target without the visible hamburger.
3. Verify dark-blue 1422×803 screenshot against provided PNG and complete light/midnight screenshots.
4. Verify all role-specific toolbar controls, server search, notification actions, logout, course/task CTA and zero-data fallback.
5. Run focused tests and full CI on exact integration SHA, then independent visual/product reviewer and owner merge decision.

## Not claimed
No live UI mount, no production deployment, no full 49-route pixel acceptance until independent integration.
