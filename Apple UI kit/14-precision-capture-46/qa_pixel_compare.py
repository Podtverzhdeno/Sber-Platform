#!/usr/bin/env python3
"""Chromium smoke for local pixel-compare.html, with synthetic PNGs (no Apple assets).

Install prerequisites:
  python -m pip install playwright
  python -m playwright install chromium
Run:
  python "Apple UI kit/14-precision-capture-46/qa_pixel_compare.py"

Never a native Apple UI or 1:1 visual certification. All PNG bytes are original
deterministic fixtures generated entirely in Python's standard library.
"""
from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-output"


def make_png_rgba(width: int, height: int, pixels: bytes) -> bytes:
    """Encode a tiny non-interlaced 8-bit RGBA PNG without Pillow."""
    assert 0 < width <= 16 and 0 < height <= 16
    assert len(pixels) == width * height * 4

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    rows = b"".join(
        b"\x00" + pixels[y * width * 4 : (y + 1) * width * 4]
        for y in range(height)
    )
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


def file_input(name: str, data: bytes) -> dict[str, str | bytes]:
    return {"name": name, "mimeType": "image/png", "buffer": data}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    source = make_png_rgba(2, 1, bytes([0, 0, 0, 255, 10, 20, 30, 255]))
    target = make_png_rgba(2, 1, bytes([0, 0, 0, 255, 20, 20, 30, 255]))
    different_size = make_png_rgba(1, 1, bytes([0, 0, 0, 255]))
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1280, "height": 800}, locale="ru-RU", accept_downloads=True)
        failures: list[str] = []
        external: list[str] = []
        page.on("pageerror", lambda exc: failures.append(str(exc)))
        page.on("request", lambda req: external.append(req.url) if req.url.startswith(("http:", "https:")) else None)
        page.route("https://**/*", lambda route: route.abort())
        page.route("http://**/*", lambda route: route.abort())
        page.goto((ROOT / "pixel-compare.html").resolve().as_uri(), wait_until="load")
        assert page.title().startswith("Impulse")

        page.locator("#reference-file").set_input_files(file_input("source.png", source))
        page.locator("#actual-file").set_input_files(file_input("web.png", target))
        assert page.locator("#compare").is_enabled()

        # Default 16-channel tolerance: RGB difference 10 changes MAE but not changed count.
        page.locator("#compare").click()
        assert page.locator("#changed").inner_text() == "0"
        assert page.locator("#ratio").inner_text() == "0.000%"
        assert page.locator("#mae").inner_text() == "1.250"

        # Zero tolerance: exactly one of two pixels differs.
        page.locator("#threshold").fill("0")
        page.locator("#compare").click()
        assert page.locator("#changed").inner_text() == "1"
        assert page.locator("#ratio").inner_text() == "50.000%"
        assert page.locator("#mae").inner_text() == "1.250"
        assert page.locator("#heatmap").get_attribute("width") == "2"
        assert page.locator("#heatmap").get_attribute("height") == "1"

        # Split/overlay controls remain interactive and keyboard reachable.
        page.locator("button[data-mode='overlay']").click()
        assert page.locator("button[data-mode='overlay']").get_attribute("aria-pressed") == "true"
        page.locator("button[data-mode='split']").click()
        page.locator("#split").evaluate(
            "(element) => { element.value = '30'; element.dispatchEvent(new Event('input', {bubbles:true})); }"
        )
        assert page.locator("#split-value").inner_text() == "30%"

        with page.expect_download() as d:
            page.locator("#save-report").click()
        download = d.value
        download.save_as(str(OUT / "pixel-compare-report.json"))
        report = json.loads((OUT / "pixel-compare-report.json").read_text(encoding="utf-8"))
        assert report["changed_pixels"] == 1
        assert report["total_pixels"] == 2
        assert report["mae_rgba_0_255"] == 1.25
        assert report["pixel_parity_certified"] is False
        assert report["source_geometry_verified"] is False

        page.screenshot(path=str(OUT / "pixel-compare-smoke.png"), full_page=True, animations="disabled")

        # Unlike auto-resizing/aligning comparators, this one refuses mismatched images.
        page.locator("#actual-file").set_input_files(file_input("wrong-size.png", different_size))
        page.locator("#compare").click()
        assert "Разные размеры" in page.locator("#status").inner_text()
        assert page.locator("#results").is_hidden()

        assert not failures, f"Browser runtime exceptions: {failures}"
        assert not external, f"Unexpected network requests: {external}"
        browser.close()

    print("PASS: synthetic PNGs, threshold/MAE, heatmap, split/overlay, JSON download, mismatched size, no network")


if __name__ == "__main__":
    main()
