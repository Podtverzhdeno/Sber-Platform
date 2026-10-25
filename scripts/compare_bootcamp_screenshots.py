"""Compare BC-R01..BC-R05 Chromium captures with the user's approved PNGs.

Inputs:
  --reference  original Impulse_Bootcamp_...zip OR extracted Impulse_Bootcamp/
  --captures   directory containing Playwright screenshots from test-results/
  --viewport   default 1448x1086

The reference HTML prototype itself is not pixel-identical to its approved PNGs.
This tool reports visual deviations; it does not silently resize, normalize,
or ignore text differences to manufacture a passing score.

Usage:
  python -m pip install Pillow
  python scripts/compare_bootcamp_screenshots.py --reference reference.zip \
      --captures frontend/test-results/bootcamp-reference --output /tmp/bootcamp-diff
"""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
from zipfile import ZipFile

try:
    from PIL import Image, ImageChops
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from exc

SCREENS = (
    ("BC-R01", "cards", "01_Bootcamp_Карточки.png"),
    ("BC-R02", "list", "02_Bootcamp_Список.png"),
    ("BC-R03", "course", "03_Popup_Детали_курса.png"),
    ("BC-R04", "why", "04_Popup_Почему_рекомендован.png"),
    ("BC-R05", "required", "05_Popup_Обязательные_курсы.png"),
)


def reference_image(path: Path, file_name: str) -> Image.Image:
    if path.is_file() and path.suffix.lower() == ".zip":
        with ZipFile(path) as archive:
            matches = [
                name
                for name in archive.namelist()
                if name.endswith("/references/" + file_name)
            ]
            if len(matches) != 1:
                raise ValueError(f"Expected one reference {file_name}, got {len(matches)}")
            return Image.open(io.BytesIO(archive.read(matches[0]))).convert("RGB")
    matches = list(path.rglob(file_name))
    matches = [match for match in matches if match.parent.name == "references"]
    if len(matches) != 1:
        raise ValueError(f"Expected one reference {file_name}, got {len(matches)}")
    return Image.open(matches[0]).convert("RGB")


def capture_image(root: Path, width: int, height: int, key: str, view: str) -> Path | None:
    # Names emitted by bootcamp-reference-capture.spec.ts, plus offline prototype.
    patterns = (f"{width}x{height}_{key}_{view}.png", f"{width}_{view}.png")
    for name in patterns:
        matches = list(root.rglob(name))
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise ValueError(f"Ambiguous captures for {name}: {matches}")
    return None


def compare(
    expected: Image.Image, actual: Image.Image, threshold: int
) -> tuple[dict, Image.Image, Image.Image]:
    if expected.size != actual.size:
        raise ValueError(
            f"Different dimensions: reference={expected.size}, capture={actual.size}; "
            "pixel comparison requires an identical viewport and document height."
        )
    difference = ImageChops.difference(expected, actual)
    # Deliberately count a pixel once when ANY channel differs > threshold.
    pixels = list(difference.getdata())
    changed = sum(1 for rgb in pixels if max(rgb) > threshold)
    abs_sum = sum(sum(rgb) for rgb in pixels)
    count = expected.width * expected.height
    metrics = {
        "reference_size": [expected.width, expected.height],
        "pixels": count,
        "changed_pixels": changed,
        "changed_percent": round(100 * changed / count, 3),
        "mean_abs_channel_difference": round(abs_sum / (count * 3), 3),
        "threshold_per_channel": threshold,
    }
    amplified = difference.point(lambda value: min(255, value * 4))
    overlay = Image.blend(expected, actual, 0.5)
    return metrics, amplified, overlay


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--captures", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--viewport", default="1448x1086")
    parser.add_argument("--threshold", type=int, default=16)
    args = parser.parse_args()
    width, height = (int(value) for value in args.viewport.lower().split("x"))
    if not 0 <= args.threshold <= 255:
        parser.error("--threshold must be between 0 and 255")
    args.output.mkdir(parents=True, exist_ok=True)

    result = {
        "viewport": args.viewport,
        "reference": str(args.reference),
        "captures": str(args.captures),
        "screens": {},
    }
    all_compared = True
    for key, view, filename in SCREENS:
        candidate = capture_image(args.captures, width, height, key, view)
        if candidate is None:
            result["screens"][key] = {"status": "missing_capture"}
            all_compared = False
            continue
        try:
            expected = reference_image(args.reference, filename)
            actual = Image.open(candidate).convert("RGB")
            metrics, heatmap, overlay = compare(expected, actual, args.threshold)
            heatmap.save(args.output / f"{key}_difference.png")
            overlay.save(args.output / f"{key}_overlay.png")
            result["screens"][key] = {"status": "compared", "capture": str(candidate), **metrics}
        except (ValueError, OSError) as exc:
            result["screens"][key] = {"status": "error", "message": str(exc)}
            all_compared = False
    path = args.output / "bootcamp_visual_diff.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(path.read_text(encoding="utf-8"))
    return 0 if all_compared else 1


if __name__ == "__main__":
    raise SystemExit(main())
