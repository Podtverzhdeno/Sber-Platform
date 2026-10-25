"""Compare the approved Impulse Events mockups against browser captures, pixel by pixel.

Inputs:
  --references directory containing the original seven PNG mockups
  --captures frontend/test-results/event-reference
  --output /tmp/events-diff

No resizing, cropping, masking, antialiasing normalization, or silent scoring.
A different image dimension is recorded as an error, not a pass.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError as exc:
    raise SystemExit("Install Pillow: python -m pip install Pillow") from exc

SCREENS = {
    "catalog": "Impulse_Events_Combined_V1_V2.png",
    "program": "impulse_events_program.png",
    "prizes": "impulse_events_prizes.png",
    "requirements": "impulse_events_requirements.png",
    "organizers": "impulse_events_organizers.png",
    "faq": "impulse_events_faq.png",
    "registration": "impulse_events_registration.png",
}


def compare(
    reference: Image.Image, capture: Image.Image, threshold: int
) -> tuple[dict, Image.Image, Image.Image]:
    if reference.size != capture.size:
        raise ValueError(
            f"dimension mismatch: reference={reference.size}, capture={capture.size}"
        )
    difference = ImageChops.difference(reference, capture)
    pixels = list(difference.getdata())
    total = reference.width * reference.height
    changed = sum(max(pixel) > threshold for pixel in pixels)
    distance = sum(sum(pixel) for pixel in pixels) / (total * 3)
    stats = {
        "reference_size": reference.size,
        "capture_size": capture.size,
        "changed_pixels": changed,
        "total_pixels": total,
        "changed_percent": round(100 * changed / total, 3),
        "mean_absolute_channel_difference": round(distance, 3),
        "threshold_per_channel": threshold,
    }
    return (
        stats,
        difference.point(lambda value: min(255, 4 * value)),
        Image.blend(reference, capture, 0.5),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--references", type=Path, required=True)
    parser.add_argument("--captures", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--threshold", type=int, default=16)
    args = parser.parse_args()
    if not 0 <= args.threshold <= 255:
        parser.error("threshold must be in [0, 255]")

    args.output.mkdir(parents=True, exist_ok=True)
    report = {}
    is_complete = True
    for name, source_name in SCREENS.items():
        baseline = args.references / source_name
        actual = args.captures / f"{name}.png"
        if not baseline.is_file() or not actual.is_file():
            is_complete = False
            report[name] = {
                "status": "missing_file",
                "reference_exists": baseline.is_file(),
                "capture_exists": actual.is_file(),
            }
            continue
        try:
            with Image.open(baseline) as reference, Image.open(actual) as capture:
                stats, difference, overlay = compare(
                    reference.convert("RGB"), capture.convert("RGB"), args.threshold
                )
            difference.save(args.output / f"{name}_difference.png")
            overlay.save(args.output / f"{name}_overlay.png")
            report[name] = {"status": "compared", **stats}
        except (OSError, ValueError) as error:
            is_complete = False
            report[name] = {"status": "error", "message": str(error)}

    (args.output / "events_visual_diff.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if is_complete else 1


if __name__ == "__main__":
    raise SystemExit(main())
