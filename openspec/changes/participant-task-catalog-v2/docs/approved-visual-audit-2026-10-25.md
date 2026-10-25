# Tasks: strict approved-PNG visual audit — 2026-10-25

## Verdict: 1:1 NOT ACCEPTED

The source ZIP **Impulse_Tasks_Design_and_Detailed_Spec(2).zip** supplies immutable 1672 × 941 approved raster references: 01 cards, 02 terms modal, 03 list. Reference 04 is a semantic-only stages illustration, **not** an alternate approved implementation design. The separate `Impulse_Tasks_UI (1).zip` adds a narrow mobile screenshot.

Actual Chromium screenshots from isolated green Tasks QA [40144354882](https://github.com/Podtverzhdeno/Sber-Platform/actions/runs/40144354882) at commit `44d4be7c6e6ce6a5df6194468a251fe1e45e9dc0` were compared **at exactly 1672×941**. The actual cards screenshot (1672×1685) and list (1672×979) were cropped to viewport height, without scaling.

| Screen | SSIM (perfect = 1.000) | Mean abs RGB error (0–255) | Pixel match ±8 per RGB channel |
|---|---:|---:|---:|
| 01 cards/detail | **0.3863** | 25.30 | 24.1% |
| 03 list | **0.3466** | 26.91 | 24.7% |
| 02 conditions | **0.4288** | 20.25 | 24.9% |

Compute with PIL and `skimage.metrics.structural_similarity(channel_axis=2, data_range=255)`, using full same-size raster. **These statistics conflate real text/data differences and visual design differences; they are diagnostic evidence, not a percentage of implementation completion.** No one may interpret passing geometry tests as proof of pixel identity.

Regional SSIM for screen 01 (same x/y crop in both images): shell header 0.415, sidebar 0.507, page heading 0.487, KPI zone 0.407, **filter bar 0.262**, left cards 0.347, right details 0.333.

## Atomized findings

| Severity | Component | Reference 1:1 discrepancy | Required acceptance |
|---|---|---|---|
| P0 | Overall | Layout and text materially differ. Current visual QA checks only partial geometric invariants | Re-capture and diff screenshots; never certify until author-reviewed accepted |
| P1 | Shared shell | Reference sidebar has 13 navigational entries; actual screenshot used simplified participant navigation. Header/sidebar sizing differs | Shell is **shared product scope**, not to be silently replaced by catalog-only code |
| P1 | Filter bar | Widths, positions, visible set and text differ; lowest regional SSIM at 0.262 | Compare each filter's x/y box, typography, focus/hover and popup. Keep non-reference filters required by SDD |
| P1 | Detail skill progression | Reference shows verified-looking numeric skills; actual app often lacks verified data and correctly uses qualitative messages | Keep data authoritative; render calculated values only if server provides verified forecast. No fake percentage for image parity |
| P1 | Modal | Reference is a compact 2-column structured modal (~657px width, ~717px visible height); actual is substantially taller due six legal disclosures plus consent control | Preserve all consent/version safety, but improve visual density and scroll handling at same 1672×941 viewport |
| P1 | Task contents | Reference company names, tags, durations, mentor photo and scores differ from test fixture/API | Only compare exact layout with identical **explicitly synthetic** test data. Do not substitute real production content |
| P2 | KPI | Reference snapshot has values 12/76%/8/10; actual synthetic fixture shows 10/72%/10/10 | API counts and denominator honest; never hardcode PNG values |
| P2 | List | 10 rendered rows and dense geometry pass; typography, boundaries, label and cell content differ | Author-review screenshot 03 with identical data and typography |
| P2 | Cards/details | Selected card, benefits and 5 planned stages pass structural tests but typography, whitespace and contents diverge | Compare bounding boxes and image regions, not only existence/count |
| P2 | Overflow | Long benefit cards at 1538px used to overflow; fixed in commit `44d4be7` and covered at 1538, 1280, 1100, 768, 390px | Retain full wrapping and no overflow for real API strings |
| P3 | Mobile | Screenshot in `Impulse_Tasks_UI (1).zip` is available, but no like-for-like current-mobile rendered capture with identical content was included in audited artifacts | Capture a matching mobile reference pair before claiming 1:1 |

## Passed functionality vs failed visual parity

Last verified Tasks QA: **24/24 frontend unit**, **12/12 browser interactions**, **6/6 geometry cases**, backend contract tests green. This supports clickability, filters, accessibility basics and specific layout safety checks, **not screenshot fidelity**.

Security / product constraints from original `tasks.md`: no fictitious task progress, fake company verification, portfolio award, forecast, appointment or outdated deadline. Never remove consent, legal versioning, eligibility guards or accessible text purely to mimic PNG.

## Next implementation sequence

1. Obtain one-to-one synthetic input fixtures for all reference designs, not just an arbitrary 10-task sample. Lock font assets, locale and CSS viewport.
2. Split visual diff into **shared shell**, **catalog cards/list**, **detail**, **terms modal**; avoid catalog-only modifications to shared navigation without product owner approval.
3. Collect element bounding boxes, font metrics, region overlays and all five UI states (cards/list/modal/stages/mobile).
4. Fix high-severity discrepancies while retaining real-world data semantics; re-run isolated QA and app-wide CI.
5. Confirm deployed Railway commit matches the accepted GitHub commit and audit the live page before closing production.

The complete matching reference/actual/50%-overlay/pixel-difference image pack is attached to the ChatGPT conversation as `Impulse_Tasks_1to1_Visual_Audit_2026-10-25.zip`. It is NOT present in the Git repository. 

**Status: visually not approved 1:1; functional QA partially/previously approved on the audited commit; production not evidenced.**
