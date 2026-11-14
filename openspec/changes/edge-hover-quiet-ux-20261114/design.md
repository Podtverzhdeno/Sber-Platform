# Design decisions

- **Activation:** fixed 18px wide mouse-only strip on the extreme left edge, below the topbar. At rest its 3×52px accent is low-contrast, revealing a cue on hover/focus. No persistent sidebar column.
- **Modes:** `drawerOpen` remains explicit/manual, `hoverOpen` is independent. The computed visibility flag `navOpen` is the union. **Only manual mode** locks body scrolling, focuses close, handles Tab trap and shows scrim; pointer preview is non-modal.
- **Transitions:** existing 300ms cubic-bezier sliding glass drawer; new text-only 270ms translateX/opacity animation in hover mode. Reduced motion disables text effects; forced-colors uses system highlight.
- **Permissions:** all links continue to derive from `actor.navigation`; no route indexes are invented, changed or hidden.
- **Space:** desktop V2 grid displays the hero and grade at 1.85:1, and moves Weekly Focus into a second line; subsequent feature cards keep their DOM order. Screen-reader h1 remains invisible. No decorative greeting is generated.
- **Touch:** the activation strip is omitted under coarse pointer/narrow layouts. Existing Menu button is always present.
- **Risk:** CSS must be verified in real browser on exact SHA because older styles have high specificity. Avoid claim of completed pixel fidelity until screenshot QA.
