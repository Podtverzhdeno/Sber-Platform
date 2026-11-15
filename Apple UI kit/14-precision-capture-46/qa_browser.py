#!/usr/bin/env python3
"""Offline Playwright smoke of Apple-informed Impulse reference lab; NEVER a 1:1 Apple parity test.

Run from a checked-out Sber-Platform revision:
  python -m pip install playwright
  python -m playwright install chromium
  python "Apple UI kit/14-precision-capture-46/qa_browser.py"

No network resources, Apple assets, production backend or live credentials required.
"""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "interactive-state-lab.html"
MANIFEST = ROOT / "manifest.json"
OUTPUT = ROOT / "qa-output"


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    records = manifest["entries"]
    assert len(records) == 46, "source capture registry must contain 46 cases"
    OUTPUT.mkdir(exist_ok=True)
    evidence: list[dict[str, object]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        for width, height in ((1440, 900), (390, 844), (320, 720)):
            page = browser.new_page(
                viewport={"width": width, "height": height},
                reduced_motion="reduce",
                device_scale_factor=1,
                locale="ru-RU",
            )
            errors: list[str] = []
            page.on("pageerror", lambda exception: errors.append(str(exception)))
            # A local file test must not silently depend on remote scripts/assets.
            page.route("https://**/*", lambda route: route.abort())
            page.route("http://**/*", lambda route: route.abort())
            page.goto(HTML.resolve().as_uri(), wait_until="load")
            assert page.title().startswith("Impulse")
            assert page.locator("#cases button").count() == 46, "expected 46 visible cases"
            assert page.locator("#count").inner_text() == "46 из 46"

            # Each indexed case must have its matching local source record.
            for idx, record in enumerate(records):
                page.locator(f'#cases button[data-index="{idx}"]').click()
                assert page.locator("#case-id").inner_text() == record["id"]
                assert page.locator("#doc").get_attribute("href") == record["record_path"]
                assert page.locator("#source").get_attribute("href") == record["hig_url"]
                assert page.locator("#stage").locator("*").count() > 0
            page.locator("#filter").fill("Message conversation")
            assert page.locator("#cases button").count() == 1
            assert page.locator("#count").inner_text() == "1 из 46"
            page.locator("#filter").fill("")
            assert page.locator("#cases button").count() == 46

            # Interactive states are previews only and use no real application API.
            page.locator('#cases button[data-index="14"]').click()  # APP-CAP-015 destructive
            page.locator('#stage button[data-action="confirm"]').click()
            assert page.locator("#dialog").evaluate("(e) => e.open")
            page.keyboard.press("Escape")
            assert not page.locator("#dialog").evaluate("(e) => e.open")

            page.locator('#cases button[data-index="16"]').click()  # APP-CAP-017 segmented
            page.locator('#stage button[data-action="segment"]').nth(1).click()
            assert (
                page.locator('#stage button[data-action="segment"]')
                .nth(1)
                .get_attribute("aria-pressed")
                == "true"
            )

            page.locator('#cases button[data-index="20"]').click()  # APP-CAP-021 forms
            page.locator('#stage input[name="title"]').fill("Тестовая задача")
            page.locator('#stage form button[type="submit"]').click()
            assert "локальную проверку" in page.locator("#status").inner_text()

            page.locator('#cases button[data-index="41"]').click()  # APP-CAP-042 messaging
            page.locator('#stage input[name="message"]').fill("Только демонстрация")
            page.locator('#stage form button[type="submit"]').click()
            assert page.locator("#stage #messages .example-bubble").count() == 1
            assert "не отправлен" in page.locator("#status").inner_text()

            page.locator('#cases button[data-index="0"]').click()
            page.locator('#stage button[data-action="menu"]').click()
            assert page.locator("#demo-menu").is_visible()
            page.keyboard.press("Escape")
            assert page.locator("#demo-menu").is_hidden()

            for theme in ("dark", "light"):
                page.locator("#theme").select_option(theme)
                assert page.evaluate("document.documentElement.dataset.theme") == theme
                file = f"state-lab-{width}x{height}-{theme}.png"
                page.screenshot(path=str(OUTPUT / file), full_page=True, animations="disabled")
                evidence.append(
                    {
                        "width": width,
                        "height": height,
                        "theme": theme,
                        "screenshot": file,
                        "page_errors": list(errors),
                    }
                )

            if errors:
                raise AssertionError(f"Browser JS errors at {width}x{height}: {errors}")
            page.close()
        browser.close()
    result = {
        "kind": "LOCAL_UI_SMOKE_ONLY",
        "official_apple_source_layers_measured": False,
        "pixel_parity_claimed": False,
        "case_count": 46,
        "views": evidence,
    }
    (OUTPUT / "report.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        f"PASS: {len(records)} cases, 3 viewports, 2 themes, interactive controls; {len(evidence)} screenshots saved to {OUTPUT}"
    )


if __name__ == "__main__":
    main()
