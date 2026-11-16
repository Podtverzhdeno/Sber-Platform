import { expect, test, type Page } from "@playwright/test";

type VisualMode = "light" | "blue" | "midnight";

const NAVIGATION = [
  "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
  "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика",
  "Сообщения", "AI-Buddy", "Настройки",
] as const;

const destinations = [
  { group: "Развитие", label: "Моя траектория", index: 1 },
  { group: "Практика", label: "Задачи", index: 3 },
  { group: "Результаты", label: "Портфолио", index: 7 },
  { group: "Сообщество", label: "Сообщения", index: 10 },
  { group: "Дополнительно", label: "Настройки", index: 12 },
] as const;

async function installParticipant(page: Page, mode: VisualMode, navigation: readonly string[] = NAVIGATION) {
  await page.addInitScript((selected: VisualMode) => {
    localStorage.setItem("impulse-visual-mode", selected);
    localStorage.setItem("impulse-theme", selected === "light" ? "light" : "dark");
  }, mode);
  const actor = {
    person_id: "00000000-0000-0000-0000-000000000001",
    display_name: "Алекс Речной",
    active_role: "participant",
    assigned_roles: ["participant"],
    scopes: [],
    consent_scopes: [],
    navigation,
    csrf_token: "five-section-theme-acceptance",
  };

  // All off-scope calls fail closed rather than depending on a local backend.
  // Explicit role, notifications and message fixtures below stay authoritative.
  await page.route("**/api/v1/**", route =>
    route.fulfill({ status: 404, json: { code: "NOT_AVAILABLE" } }));
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { demo_mode: true, honor_board_enabled: false } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/notifications", route =>
    route.fulfill({ json: { items: [], unread: 0 } }));
  await page.route("**/api/v1/me/messaging/channels", route =>
    route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/contacts", route =>
    route.fulfill({ json: [] }));
}

async function openOverlay(page: Page) {
  await page.getByRole("button", { name: "Impulse — открыть разделы", exact: true }).click();
  const overlay = page.getByRole("dialog", { name: "Главное меню" });
  await expect(overlay).toBeVisible();
  return overlay;
}

async function assertNoDocumentOverflow(page: Page, section: string) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${section}: unwanted horizontal document overflow`).toBeLessThanOrEqual(2);
}

async function assertThemeTokens(page: Page, mode: VisualMode) {
  const details = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const parseColor = (value: string) => {
      const hex = value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
      return [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    };
    const luminance = (rgb: number[] | null) => {
      if (!rgb) return null;
      const channels = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const text = luminance(parseColor(style.getPropertyValue("--color-text")));
    const surface = luminance(parseColor(style.getPropertyValue("--color-surface")));
    return {
      theme: document.documentElement.dataset.theme,
      contrast: text === null || surface === null
        ? 0 : (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05),
      surfaceLightness: surface,
      textLightness: text,
    };
  });

  expect(details.theme).toBe(mode === "light" ? "light" : "dark");
  expect(details.contrast, "semantic text/surface contrast must meet WCAG AA").toBeGreaterThanOrEqual(4.5);
  if (mode === "light") {
    expect(details.surfaceLightness).toBeGreaterThan(0.8);
    expect(details.textLightness).toBeLessThan(0.1);
  } else {
    expect(details.surfaceLightness).toBeLessThan(0.1);
    expect(details.textLightness).toBeGreaterThan(0.8);
  }
}

for (const mode of ["light", "blue", "midnight"] as const) {
  for (const width of [320, 1440]) {
    test(`authorized five-section journey at ${String(width)}px in ${mode} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 700 : 900 });
      await installParticipant(page, mode);
      await page.goto("/workspace/0", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Impulse — открыть разделы" })).toBeVisible();
      await assertThemeTokens(page, mode);

      for (const destination of destinations) {
        const menu = await openOverlay(page);
        const group = menu.getByRole("button", { name: destination.group, exact: true });
        if (await group.getAttribute("aria-expanded") !== "true") await group.click();
        const link = menu.getByRole("link", { name: destination.label, exact: true });
        await expect(link).toHaveAttribute("href", `/workspace/${String(destination.index)}`);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/workspace/${String(destination.index)}(?:[?]|$)`));
        await expect(menu).toBeHidden();
        await expect(page.locator(".workspace-content")).toBeVisible();
        await assertThemeTokens(page, mode);
        if (width === 320) await assertNoDocumentOverflow(page, destination.label);
        await page.goBack({ waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/workspace\/0(?:[?]|$)/);
      }

      const menu = await openOverlay(page);
      await expect(menu.getByRole("link", { name: "Главная", exact: true }))
        .toHaveAttribute("href", "/workspace/0");
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      if (width === 320) await assertNoDocumentOverflow(page, "Главная");
    });
  }
}

test("server-omitted Rating never appears in a grouped navigation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installParticipant(page, "light", NAVIGATION.filter(label => label !== "Рейтинг"));
  await page.goto("/workspace/0", { waitUntil: "domcontentloaded" });
  const menu = await openOverlay(page);
  const results = menu.getByRole("button", { name: "Результаты", exact: true });
  await results.click();
  await expect(menu.getByRole("link", { name: "Рейтинг", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Портфолио", exact: true })).toBeVisible();
  await assertNoDocumentOverflow(page, "Закрытая роль");
});
