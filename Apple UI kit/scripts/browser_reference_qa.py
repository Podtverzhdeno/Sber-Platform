#!/usr/bin/env python3
"""Optional Chromium QA for the independent Apple-inspired web study.

Requires: python -m pip install playwright && python -m playwright install chromium
No Impulse API writes, Figma layer inspection, Apple font downloads, or external navigation.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

try:
    from playwright.sync_api import sync_playwright, Error as PlaywrightError
except ImportError:
    raise SystemExit("Install Playwright first: python -m pip install playwright")

HERE = Path(__file__).resolve().parents[1] / "web-implementation" / "index.html"
VIEWPORTS = [(320, 720), (390, 844), (1024, 768), (1422, 803), (1440, 900)]


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def exercise_desktop(page: object, out: Path | None) -> int:
    """Perform basic behavior and visual capture in Chromium."""
    checks = 0
    page.goto(HERE.resolve().as_uri(), wait_until="load")
    check(page.locator("#tasks li").count() == 3, "expected 3 synthetic rows")
    checks += 1

    check(
        page.locator("#drawer").get_attribute("inert") is not None, "drawer must be inert initially"
    )
    page.locator("#menuBtn").click()
    check(page.locator("#drawer").get_attribute("data-open") == "true", "drawer did not open")
    check(
        page.locator("#closeDrawer").evaluate("(el) => document.activeElement === el"),
        "drawer close is not focused",
    )
    page.keyboard.press("Escape")
    check(
        page.locator("#drawer").get_attribute("data-open") == "false", "Escape did not close drawer"
    )
    check(
        page.locator("#menuBtn").evaluate("(el) => document.activeElement === el"),
        "focus not restored to menu",
    )
    checks += 1

    page.locator("#profileBtn").click()
    check(page.locator("#profilePop").is_visible(), "popover did not open")
    page.keyboard.press("Escape")
    check(not page.locator("#profilePop").is_visible(), "popover did not close")
    checks += 1

    page.locator("#tabCustomer").click()
    check(
        page.locator("#tabCustomer").get_attribute("aria-selected") == "true", "customer tab state"
    )
    check(
        page.locator("#tasks").inner_text().find("Техническое задание") >= 0,
        "customer list not updated",
    )
    page.locator("#tabParticipant").click()
    page.locator("#search").fill("доступ")
    check(page.locator("#tasks li").count() == 1, "search did not filter synthetic rows")
    page.locator("#search").fill("")
    checks += 1

    page.locator('[data-state="empty"]').click()
    check(page.locator("#empty").is_visible(), "empty state not shown")
    page.locator('[data-state="error"]').click()
    check("Ошибка" in page.locator("#empty").inner_text(), "error state missing")
    check(
        page.locator("#empty").get_attribute("role") == "alert",
        "error state must be announced urgently",
    )
    page.locator("#empty").get_by_role("button", name="Повторить пример").click()
    check(page.locator("#tasks li").count() == 3, "error retry did not restore ready state")
    page.locator("#search").fill("несуществующий-пример")
    check(
        page.locator("#empty").get_by_role("button", name="Очистить поиск").is_visible(),
        "search clear recovery missing",
    )
    page.locator("#empty").get_by_role("button", name="Очистить поиск").click()
    check(page.locator("#tasks li").count() == 3, "clear search did not restore rows")
    checks += 1

    page.locator('[data-glass-choice="clear"]').click()
    check(
        page.locator("#glassExample").get_attribute("data-glass") == "clear", "clear glass toggle"
    )
    page.locator('[data-glass-choice="regular"]').click()
    check(
        page.locator("#glassExample").get_attribute("data-glass") == "regular",
        "regular glass toggle",
    )
    checks += 1

    old_theme = page.locator("html").get_attribute("data-theme")
    page.locator("#themeBtn").click()
    check(page.locator("html").get_attribute("data-theme") != old_theme, "theme did not switch")
    page.locator("#themeBtn").click()
    checks += 1

    page.locator('#sampleForm button[type="submit"]').click()
    check(page.locator("#formError").is_visible(), "required field validation hidden")
    page.locator("#taskName").fill("Демонстрация")
    page.locator("#consent").check()
    page.locator('#sampleForm button[type="submit"]').click()
    check(not page.locator("#formError").is_visible(), "valid form still in error")
    checks += 1

    page.locator("#newBtn").click()
    check(page.locator("#dialog").is_visible(), "dialog did not open")
    page.keyboard.press("Escape")
    check(not page.locator("#dialog").is_visible(), "dialog did not close by Escape")
    checks += 1

    for width, height in VIEWPORTS:
        page.set_viewport_size({"width": width, "height": height})
        overflow = page.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        check(overflow <= 2, f"horizontal overflow at {width}x{height}: {overflow}px")
        if width <= 390:
            check(page.locator("#search").is_visible(), f"search unavailable at {width}px")
            page.locator("#search").fill("доступ")
            check(page.locator("#tasks li").count() == 1, f"mobile search failed at {width}px")
            page.locator("#search").fill("")

        if out is not None:
            page.screenshot(path=str(out / f"reference-{width}x{height}.png"), full_page=True)
        checks += 1
    return checks


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--screenshots-dir",
        type=Path,
        help="Optional local screenshots (do not commit Apple images)",
    )
    args = parser.parse_args(argv)
    if not HERE.is_file():
        print("Reference lab not found: " + str(HERE))
        return 2
    if args.screenshots_dir:
        args.screenshots_dir.mkdir(parents=True, exist_ok=True)

    errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ru-RU")
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            n = exercise_desktop(page, args.screenshots_dir)
            check(not errors, "browser JS errors: " + "; ".join(errors))
            context.close()
            touch = browser.new_context(
                viewport={"width": 390, "height": 844},
                locale="ru-RU",
                has_touch=True,
                is_mobile=True,
                reduced_motion="reduce",
            )
            mobile = touch.new_page()
            mobile.goto(HERE.resolve().as_uri(), wait_until="load")
            mobile.locator("#menuBtn").tap()
            check(mobile.locator("#drawer").get_attribute("data-open") == "true", "touch drawer")
            mobile.locator("#closeDrawer").tap()
            check(mobile.locator("#drawer").get_attribute("data-open") == "false", "touch close")
            touch.close()
            browser.close()
        print(f"PASS: {n + 2} browser checks, five responsive viewports, touch and reduced-motion")
        print(
            "NOT VERIFIED: Apple source frame parity, owner pixel diff, native Liquid Glass or full Impulse app"
        )
        return 0
    except (AssertionError, PlaywrightError) as error:
        print("FAIL: " + str(error))
        return 1


if __name__ == "__main__":
    sys.exit(main())
