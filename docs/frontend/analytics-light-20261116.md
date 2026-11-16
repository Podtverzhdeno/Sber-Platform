# Analytics V3 — Apple minimalism/light regression (16 November 2026)

Source reference: `Apple UI kit/06-cases/06-data-and-dashboards/README.md` and official Apple HIG **Lists and tables**, **Progress indicators**, **Materials**.

Change is **presentation-only**, applied to `:root[data-theme="light"]`:
- solid calendar surface, readable labels, precise heatmap intensity and unknown state;
- light tooltip and portaled day-details dialog with event source and source-kind labels;
- light nested Bootcamp learning, activity KPIs and certification detail panels;
- retained blue and midnight themes and source-driven zero/unknown distinctions.

Acceptance: Chromium 3 visual modes × 320/390/1440px, true computed background colors, actual calendar day popup, certification and level dialog, no document horizontal overflow. No API or field logic changes.
