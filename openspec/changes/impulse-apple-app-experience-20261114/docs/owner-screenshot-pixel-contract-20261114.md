# Assistant-generated Impulse preview measurements · NOT owner's four originals · 2026-11-14

> **PROVENANCE CORRECTION (2026-11-14):** This document measures a **previous assistant-generated Impulse concept archive** and is **NOT** an analysis of the owner's four uploaded UI images. The owner's real originals (1000×750, 2048×1292, 2048×1147, 1500×914) are independently verified and documented in [owner-true-originals-analysis-20261114.md](owner-true-originals-analysis-20261114.md). The original desktop 245px/sidebar and 1440px layout numbers below are *assistant concept targets only*, not owner-source measurements. Any statements below calling these files "original owner screenshots" are superseded by this notice. No assets are silently replaced.



**STATUS:** AUTHORITATIVE USER REFERENCES, design-only. The user explicitly interrupted implementation to establish four screenshots as the primary aesthetic source. **STOP** the in-progress shared-theme implementation/deploy until this reference set is understood and accepted. Existing Railway production SHA `277a163f777af66ff152fab1fa30d0a2909b5b56` stays unchanged.

**Persistence:** the original four PNG files plus JSON/README checksums are stored in the owner's personal ChatGPT Library folder `/Impulse-UI-References-2026-11-14/`, archive `impulse-reference-pack-20261114.zip`; they are also available as a conversation artifact. This public GitHub specification intentionally includes **hashes and detailed measurements only**; it does not expose personal Library URLs or re-publish binary files. The archive is required for direct screenshot/overlay checks. All four are static conceptual screenshots, not proof of live production rendering.

## 1. Exact original files, unchanged

| Priority | Archive file | Source file | Pixel canvas | SHA-256 |
|---|---|---|---|---|
| A1 **primary desktop** | `01-apple-desktop.png` | `impulse-apple-home-desktop.png` | **1440 × 900** | `0d14cc50d86ea796ba441072cd300542553ddca49dd6c8b755a2633540904503` |
| A2 **primary mobile** | `02-apple-mobile.png` | `impulse-apple-home-mobile.png` | **390 × 895** | `9ed05c61f52bea2062729dc866aa9deed90ca0175f61cc1b9e924a802f1443c1` |
| B1 secondary desktop | `03-calm-desktop.png` | `impulse-calm-home-desktop.png` | **1440 × 1227** | `ed5559f6aae074fc6fe903183c7c3e0b7f9b2c66e839a3751e35d0d9b50cc034` |
| B2 secondary mobile | `04-calm-mobile.png` | `impulse-calm-home-mobile.png` | **390 × 1634** | `c6dc48ae049053e0ac94ecb3282834b08bf67d7168a520534e522f4b5f83491f` |

## 2. Priority and direction

A1/A2 are the **visual north star**:
- Matte **white canvas**, nearly flat, generous space, restrained right-angle alignment and very subtle separators. Not glassy SaaS.
- Sidebar neutral light gray, clear navigation labels with 1 active soft-gray group. The content is noticeably calmer than the sidebar.
- **One** quiet light-gray focus surface / one vividly blue action. No competing colored KPIs, illustrations, outer workspace card, spotlight orbit, glowing borders, promo-style captions or decorative charts.
- Three **inline** factual status readings rather than three KPI tiles.
- Remaining actions exposed as low-contrast row disclosures with chevrons.
- A blue accent for primary navigation/action; small neutral icons; bottom of sidebar should not carry business-critical action.

B1/B2 are **functional depth references**, not a conflicting default style:
- Cards for tasks/week requirements (where information density demands it).
- Progress rail, weekly seven-day component, task row, explicit requirements.
- B's forest-green accent is **alternative mood** only; in final default apply A blue accent across app. B's extra cards should be hidden under named L1/L2 disclosures unless the screen legitimately needs them to operate.
- B shows an older version with overlines, a large hero and horizontal metric card; do **not** reintroduce these if they conflict with A.

**Content is synthetic.** The screenshots' example role `AI Agent Engineer`, task title and numbers (`L1`, `2`, `4`) are placeholders only. Never hardcode them; API/permission truth takes priority over screenshot symmetry.

## 3. Pixel-measured anchors: A1 desktop 1440×900

Coordinates below come from the supplied PNG's pixel map; first/last anti-aliased text pixels and rounded corners can vary ~1–3px.

| Element | Pixel positions | Design target |
|---|---|---|
| Sidebar | x = **0–244** (245px wide); vertical divider x≈245 | fixed left navigation width 245px, soft gray `#F7F7F9` |
| Global toolbar | y≈0–67 above content, x≥246 | 68px tall, white, 1px subtle bottom boundary |
| Main white canvas | x≥246 | `#FFFFFF`, no large enclosing border |
| Main content left alignment | x≈**374** | 128px horizontal inset from workspace start at 1440 |
| Main content right edge | x≈**1312** | effective content width ≈938px |
| Page heading | top y≈126, font ≈36px bold, left x≈374 | one H1, no overline |
| Role subtitle | below heading, ~14px muted | one simple context line |
| First action surface | **x=374..1311, y=223..427** | width **938px**, height **205px**, radius ~18px, fill `#F5F5F7` |
| Focus heading | in card x≈409, y≈315 | font 24–27px, weight 650–700 |
| Primary button | at right x≈1106..1277, y≈302..348 | blue `#007AFF`, approx 171×46px, 10–12px radius |
| Facts line | y≈468..533 | three equal **unboxed** columns and only two slender separators |
| Following thin divider | y≈554 | #E5E5EA, 1px |
| Level/requirement row | y≈555–645 | one level title and one text action on right |
| Progress / Work / Tools disclosure rows | around y≈646,726,806 | each ~80px high; dividers at y≈646,726,806,886 |
| Footer disclaimer | bottom right | **not** part of production UX; concept-only mark |

**Measured dominant colors A1:** `#FFFFFF` (canvas), `#F7F7F9` (sidebar), `#F5F5F7` (focus fill), `#E5E5E9` / `#E5E5EA` (borders), `#007AFF` (action), `#1D1D1F` (primary text), `#59595F` (secondary).

Desktop proportions are a reference for 1440px only. For 1024px, the main content inset must decrease so it does not truncate content; for 1920px content max width limits line length. Screens with tables may use wider content width than Home.

## 4. Pixel-measured anchors: A2 mobile 390×895

| Element | Pixel positions | Design target |
|---|---|---|
| Top compact bar | ~y 0–53 | x=18 menu, search/notifications/avatar on right |
| Content left/right gutters | **19px** on both sides | content 352px wide |
| Page H1 | begins around x=19/y=85, ≈30px | title visible before focus |
| Context / route shortcut | around y≈126 | real active role, path shortcut |
| Primary focus | **x=19..370, y=167..386** | width **352px**, height **220px**, corner radius ~17px |
| Focus heading | x≈39 and y≈221 | wraps naturally to two lines |
| Primary CTA | within card, x≈39..351, y≈319..365 | full width **312px** |
| Inline metrics | y≈423–505 | three compact columns; values do not become boxed cards |
| Following divider | around y≈505 | 1px |
| Level and requirements | y≈529–650 | more vertical area, no overlap with CTA |
| Disclosure rows | after y≈650 | each ~80px with chevron |

Primary mobile CTA must remain a real button at 320px, 390px, 200% zoom. The pixel bounds above describe screenshot geometry, **not** hard fixed heights when content length varies.

## 5. Secondary B screenshots

B1: white content cards on matte `#F7F8F8` canvas (1440×1227), content roughly x≈103..1337, large introductory card from y≈140, three metric tiles, two-column work/week and progress. B2 (390×1634) uses gutter x≈16, the same cards stacked, 7-day calendar and a scrollable longer home.

B elements are **library for L1/L2 detail presentations**, not an instruction to move the initial fold down or show every secondary card by default.

## 6. Pixel fidelity execution protocol

1. Reference files' SHA-256 checked before every comparison. No editing source images.
2. Render at **exact** reference CSS viewport and `deviceScaleFactor=1`, fixed browser zoom 100%, deterministic supplied fixture. A1 **1440×900**, A2 **390×895**. Yandex Browser / Chrome Windows and browser font stack recorded separately.
3. Align and overlay screenshot at 50% opacity. Measure sidebar width, header height, content bounds, focus x/y/w/h, button and row spacing. Aim **≤4 CSS px** structural offset at the exact desktop/mobile reference size; **≤2 CSS px** for thin divider alignment when deterministic. Font antialiasing and unknown system font widths are evaluated visually, not by naïve strict per-pixel equality.
4. Compare local semantic tokens to reference color samples; use a script that reports ΔE/contrast. Keep AA >=4.5:1 body text, >=3:1 for large/nontext. Dark design is a **semantic inversion**, not a photographic negative; use neutral dark surfaces and the same clear hierarchy.
5. Screenshot diff **cannot replace behavior tests**. Run 49 role×route navigation, 42 action-family parity, long Russian labels, unavailable states, 320px/200% zoom, keyboard and high-impact warnings. No missing flows to fit the screenshot.
6. Every screen in `screen-templates-pixel-map.md` uses A1/A2 geometry grammar and has its own selected state/interaction details. An independent reviewer checks light/dark and desktop/mobile before owner acceptance.
7. No reusing Apple branded font files/logos/SF Symbols assets. Recreate the *design grammar* and relative alignment using owned web CSS, not third-party IP.

## 7. Redesign release blocker

**DO NOT resume broad CSS overrides or upload the interrupted implementation branch to Railway** until these four references, new web references, screen templates and 49-role functional parity are reconciled. The two theme component draft files currently in `feat/impulse-global-futurist-ui-20261114` are not reviewed or deployed. The existing production stays on its last successful SHA.
