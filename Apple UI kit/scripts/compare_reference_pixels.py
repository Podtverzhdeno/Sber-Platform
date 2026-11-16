#!/usr/bin/env python3
"""Compare two legally obtained reference/render PNG images at equal dimensions.

Optional dependency: Pillow (python -m pip install Pillow).
Makes a 50/50 overlay, enhanced RGB diff and JSON metrics. Does NOT prove
source-frame provenance, native Apple Liquid Glass equality, or design acceptance.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

try:
    from PIL import Image, ImageChops, ImageEnhance
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from exc


def compare(source: Path, candidate: Path, out: Path, threshold: int) -> dict[str, object]:
    if not 0 <= threshold <= 255:
        raise ValueError("threshold must be in 0..255")
    with Image.open(source) as image:
        a = image.convert("RGB")
    with Image.open(candidate) as image:
        b = image.convert("RGB")

    if a.size != b.size:
        raise ValueError(
            f"Source {a.size} and candidate {b.size} differ; capture both "
            "at identical CSS viewport, DPR and crop. No automatic resizing."
        )

    out.mkdir(parents=True, exist_ok=True)
    n = a.width * a.height
    total_abs_rgb = 0
    mismatch = 0
    min_x, min_y = a.width, a.height
    max_x, max_y = -1, -1
    # Pixel-wise check: channels are RGB, and a pixel differs if its
    # maximum absolute channel difference is strictly greater than threshold.
    for pos, (left, right) in enumerate(zip(a.getdata(), b.getdata())):
        diffs = (abs(left[0] - right[0]), abs(left[1] - right[1]), abs(left[2] - right[2]))
        total_abs_rgb += sum(diffs)
        if max(diffs) > threshold:
            mismatch += 1
            x, y = pos % a.width, pos // a.width
            min_x, max_x = min(min_x, x), max(max_x, x)
            min_y, max_y = min(min_y, y), max(max_y, y)

    overlay_path = out / "overlay.png"
    diff_path = out / "difference.png"
    report_path = out / "report.json"
    Image.blend(a, b, 0.5).save(overlay_path)
    ImageEnhance.Contrast(ImageChops.difference(a, b)).enhance(3).save(diff_path)
    bbox = [min_x, min_y, max_x + 1, max_y + 1] if mismatch else None
    result: dict[str, object] = {
        "source": str(source),
        "candidate": str(candidate),
        "resolution_px": [a.width, a.height],
        "threshold_max_rgb": threshold,
        "pixels_total": n,
        "pixels_mismatched": mismatch,
        "pixels_mismatched_percent": round(mismatch * 100 / n, 6),
        "mean_absolute_error_rgb": round(total_abs_rgb / (3 * n), 6),
        "mismatch_bbox_xyxy_exclusive": bbox,
        "overlay_path": str(overlay_path),
        "difference_path": str(diff_path),
        "disclaimer": (
            "Image arithmetic only. No Apple kit frame inspection, "
            "source/rights verification, native effect equivalence, "
            "or independent visual acceptance."
        ),
    }
    report_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Approved reference PNG, legally obtained")
    parser.add_argument("candidate", type=Path, help="Impulse browser screenshot PNG")
    parser.add_argument("--out", type=Path, default=Path("pixel-diff-output"), help="Output folder")
    parser.add_argument(
        "--threshold", type=int, default=12, help="Max channel delta threshold 0..255"
    )
    parser.add_argument(
        "--max-mismatch-pct",
        type=float,
        default=None,
        help="Optional failure threshold; default is diagnostic-only",
    )
    args = parser.parse_args(argv)
    try:
        result = compare(args.source, args.candidate, args.out, args.threshold)
    except (OSError, ValueError) as exc:
        parser.exit(2, f"Error: {exc}\n")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if args.max_mismatch_pct is not None:
        if not 0 <= args.max_mismatch_pct <= 100:
            parser.exit(2, "Error: --max-mismatch-pct must be 0..100\n")
        if float(result["pixels_mismatched_percent"]) > args.max_mismatch_pct:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
