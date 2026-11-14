# Quiet hover navigation and whitespace-first participant home

## Why
The owner approved the visual tone, but wants the sidebar hidden until the pointer approaches the left edge and the participant dashboard less crowded. Remove the design-concept welcome copy ("С возвращением" and "Продолжите с того места, где остановились") instead of replacing it with another banner.

## Scope
- Desktop pointer-fine edge hotspot opens a lightweight non-modal side panel without consuming a layout column.
- Existing explicit Menu button, overlay modal and mobile touch navigation remain functional.
- Slide in labels with subtle motion, with reduced-motion and high-contrast fallbacks.
- At 1200px+ give the participant's home wider spacing: primary recommendation and level first, week/calendar and lower-priority widgets below. All content and handlers retained.
- Existing V2 home already has only a screen-reader heading. Do not add any visible welcome heading. The legacy `?v2=0` home remains as-is, separately gated.

## Coordination
Implementation on a separate owner-requested branch because a prior integration claim still lists the sidebar and overlay stylesheet. Independent review/rebase needed before merging.
