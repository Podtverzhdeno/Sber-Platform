# Pixel diff helper — rigorous source capture versus web approximation

The script in scripts/compare_reference_pixels.py compares **two user-authorized, equal-size PNGs**. It does not download copyrighted files; Apple licensed design exports must remain in a permitted private workspace.

## Run

1. Export the exact approved source frame or owner-approved screenshot.
2. Capture actual Impulse at matching viewport, device pixel ratio, zoom, browser, theme and source-consistent data.
3. If you have Pillow installed, run:

    python -m pip install Pillow
    python "Apple UI kit/scripts/compare_reference_pixels.py" source.png candidate.png --out diff-1422 --threshold 12

4. Inspect output/report.json, output/overlay.png and output/difference.png. The report has RGB MAE, percentage over threshold and bounding box of changed pixels.
5. Gate only once a reviewer defines an approved threshold and masks/antialiasing treatment for that specific capture, for example:

    python "Apple UI kit/scripts/compare_reference_pixels.py" source.png candidate.png --out diff-1422 --threshold 12 --max-mismatch-pct 2

6. Test helper correctness with:

    python -m unittest discover -s "Apple UI kit/scripts" -p "test_compare_reference_pixels.py" -v

Important: This is a numerical pixel comparator, **not an automatic assertion of Apple UI kit 1:1 fidelity**. The script deliberately rejects size mismatch rather than resizing one image (which could hide layout errors). Antialiasing, platform fonts, OS-native refraction, system preferences and dynamically rendered content can prevent byte-identical screenshots even for visually aligned pages. Do not claim proof without source provenance, licensing review, behavior/ARIA checks and independent visual acceptance.

No original screenshot, exported Apple font or proprietary kit binary should be committed as part of this procedure. Keep local comparison output out of Git.
