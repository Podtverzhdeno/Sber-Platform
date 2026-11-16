#!/usr/bin/env python3
"""Compare two *locally owned/authorized* screenshots. Do not commit Apple kit captures.

Requires Pillow: python -m pip install Pillow
Example:
python "Apple UI kit/04-web-reference/compare-screenshots.py" \
  --reference "Apple UI kit/_local-reference/source.png" \
  --candidate "Apple UI kit/_local-reference/impulse.png"

This is pixel-difference diagnostics, NOT a claim of parity between native Liquid
Glass and CSS, and NOT a pass/fail certification. Keep output outside git.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageEnhance, ImageStat
except ImportError:
    sys.exit("Pillow is required: python -m pip install Pillow")


def args_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--reference", required=True, type=Path)
    p.add_argument("--candidate", required=True, type=Path)
    p.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "_local-output",
        help="Ignored local directory for output PNG files",
    )
    p.add_argument(
        "--threshold",
        type=int,
        default=20,
        help="Mark pixel changed when max per-channel difference > threshold (0..255)",
    )
    return p


def flatten_rgb(path: Path) -> Image.Image:
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
    canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    return Image.alpha_composite(canvas, rgba).convert("RGB")


def main() -> int:
    options = args_parser().parse_args()
    if not 0 <= options.threshold <= 255:
        sys.exit("--threshold must be between 0 and 255")
    for path in (options.reference, options.candidate):
        if not path.is_file():
            sys.exit(f"Screenshot file does not exist: {path}")

    reference = flatten_rgb(options.reference)
    candidate = flatten_rgb(options.candidate)
    if reference.size != candidate.size:
        sys.exit(
            f"Size mismatch: ref {reference.size}, candidate {candidate.size}. "
            "Retake at exact matching viewport and device scale; "
            "automatic resizing would invalidate pixel comparisons."
        )

    delta = ImageChops.difference(reference, candidate)
    width, height = reference.size
    total = width * height
    if total == 0:
        sys.exit("Empty screenshot")

    mean_abs_error = sum(ImageStat.Stat(delta).mean) / 3
    # A pixel is changed when ANY RGB channel differs beyond the threshold.
    max_channel = Image.new("L", reference.size)
    dr, dg, db = delta.split()
    from PIL import ImageChops as Chops

    max_channel = Chops.lighter(Chops.lighter(dr, dg), db)
    mask = max_channel.point(lambda n: 255 if n > options.threshold else 0)
    changed_fraction = ImageStat.Stat(mask).mean[0] / 255

    options.out_dir.mkdir(parents=True, exist_ok=True)
    output_overlay = options.out_dir / "overlay.png"
    output_difference = options.out_dir / "difference.png"
    output_mask = options.out_dir / "changed-mask.png"
    Image.blend(reference, candidate, 0.5).save(output_overlay)
    ImageEnhance.Contrast(delta).enhance(3).save(output_difference)
    mask.save(output_mask)

    print(f"Viewport/image: {width} x {height}")
    print(f"Mean absolute RGB error: {mean_abs_error:.3f} / 255")
    print(f"Changed pixels (max channel > {options.threshold}): {changed_fraction:.2%}")
    print(f"Overlay: {output_overlay}")
    print(f"Difference: {output_difference}")
    print(f"Mask: {output_mask}")
    print(
        "Interpretation: screenshot diff alone cannot certify native-glass "
        "parity, visual quality, accessibility or copyright compliance."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
