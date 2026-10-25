import { expect, test, type Page } from "@playwright/test";

const actor = { person_id: "00000000-0000-0000-0000-000000000001", display_name: "Алекс Речной", active_role: "participant", assigned_roles: ["participant"], scopes: [], consent_scopes: [], navigation: ["Главная", "События"], csrf_token: "csrf-events" };
const event = { key: "ai-journey", title: "AI Journey 2026", event_type: "Хакатон", organizer: "Сбер", conditions: "Команда до четырёх человек", source_url: "https://example.test/event", deadline_at: null, starts_at: null, status: "open", track_keys: ["python"], recommendation_reason: "Соответствует активной траектории", source_checked_at: "2026-10-20T08:00:00Z", source_status: "current" };

async function api(page: Page) {
  let loggedIn = false;
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: actor }); });
  await page.route("**/api/v1/ecosystem/events", (route) => route.fulfill({ json: { items: [event], next_cursor: null, has_more: false } }));
  await page.route("**/api/v1/ecosystem/events/ai-journey", (route) => route.fulfill({ json: { ...event, description: "Практический хакатон", target_audience: "Разработчики", prerequisites: ["Python"], program: [{ day: "День 1", title: "Прототип", detail: "Собрать решение" }], expected_result: "Рабочий прототип", participation_rules: "По регистрации", venue_format: "Онлайн", timezone: "Europe/Moscow", ends_at: null, rewards: [] } }));
  await page.route("**/api/v1/ecosystem/events/ai-journey/registration", (route) => route.fulfill({ json: { event_key: "ai-journey", started_registrations: 25, confirmed_registrations: 18, participations: 7, counter_state: "ok", computed_at: "2026-10-20T08:00:00Z", source_checked_at: "2026-10-20T08:00:00Z", definition: "confirmed_registrations", definition_version: 1, definition_text: "Подтверждённые регистрации", contains_personal_data: false } }));
}

test("event catalog preserves list/filter/detail through URL, reload and Back", async ({ page }) => {
  await api(page); await page.goto("/"); await page.locator('[data-persona="participant-alex"]').click(); await page.getByRole("link", { name: "События" }).click();
  await page.getByRole("button", { name: "Список" }).click();
  await page.getByLabel("Направление").selectOption("python");
  await expect(page).toHaveURL(/view=list/); await expect(page).toHaveURL(/track=python/);
  await page.getByRole("button", { name: "Подробнее" }).focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/event=ai-journey/); await expect(page.getByTestId("event-detail")).toContainText("18");
  await page.reload(); await expect(page.getByTestId("event-detail")).toContainText("Практический хакатон");
  await page.goBack(); await expect(page).not.toHaveURL(/event=/); await expect(page.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
});

test("event detail remains readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await api(page); await page.goto("/"); await page.locator('[data-persona="participant-alex"]').click(); await page.getByRole("button", { name: "Меню", exact: true }).click(); await page.getByRole("link", { name: "События" }).click(); await page.getByRole("button", { name: "Подробнее" }).click(); await expect(page.getByRole("dialog", { name: "AI Journey 2026" })).toBeVisible(); await expect(page.getByText("7")).toBeVisible();
});


test("events reference: all six detail states, registration flow and keyboard navigation", async ({ page }) => {
  await api(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "События" }).click();
  await expect(page.getByTestId("events-v2")).toBeVisible();
  await page.setViewportSize({ width: 1586, height: 1081 });
  await page.screenshot({ path: "test-results/event-reference/catalog.png", animations: "disabled", fullPage: false });
  await page.setViewportSize({ width: 1703, height: 924 });
  await expect(page.getByText("События, которые подходят")).toBeVisible();
  await page.getByRole("button", { name: "Подробнее" }).click();
  const dialog = page.getByRole("dialog", { name: "AI Journey 2026" });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/about.png", animations: "disabled" });
  const bounds = await dialog.boundingBox();
  if (!bounds) throw new Error("Detail modal is missing");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing browser viewport");
  expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThan(4);
  await page.setViewportSize({ width: 1667, height: 939 });
  const nav = dialog.getByRole("navigation", { name: "Разделы события" });
  await nav.getByRole("button", { name: "Программа" }).click();
  await expect(dialog.getByText("Программа мероприятия")).toBeVisible();
  await expect(dialog.getByText("Собрать решение")).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/program.png", animations: "disabled" });
  await nav.getByRole("button", { name: "Призы и возможности" }).click();
  await expect(dialog.getByText("Призы", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/prizes.png", animations: "disabled" });
  await nav.getByRole("button", { name: "Требования" }).click();
  await expect(dialog.getByText("Требования к участникам")).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/requirements.png", animations: "disabled" });
  await nav.getByRole("button", { name: "Организаторы" }).click();
  await expect(dialog.getByText("Организаторы и партнёры")).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/organizers.png", animations: "disabled" });
  await nav.getByRole("button", { name: "FAQ" }).click();
  await expect(dialog.getByText("Частые вопросы")).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/faq.png", animations: "disabled" });
  await dialog.locator("summary").first().click();
  await expect(dialog.getByText("Разработчики")).toBeVisible();
  await nav.getByRole("button", { name: "Зарегистрироваться" }).click();
  const registration = dialog.getByTestId("event-registration");
  await expect(registration).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/registration.png", animations: "disabled" });
  await registration.getByPlaceholder("Иван Иванов").fill("Тест Участник");
  await registration.getByPlaceholder("example@mail.ru").fill("participant@example.test");
  await registration.getByRole("button", { name: "Далее" }).click();
  await registration.getByRole("button", { name: "Далее" }).click();
  await registration.getByRole("checkbox").check();
  await registration.getByRole("button", { name: "Подготовить заявку" }).click();
  await expect(registration.getByText("Анкета подготовлена")).toBeVisible();
  await page.screenshot({ path: "test-results/event-reference/registration_complete.png", animations: "disabled" });
  await expect(registration.getByRole("link", { name: /Перейти к регистрации/ })).toHaveAttribute("href", event.source_url);
  await registration.getByRole("button", { name: "Закрыть регистрацию" }).click();
  await expect(registration).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("events reference: filters, favorite, motion and empty state", async ({ page }) => {
  await api(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "События" }).click();
  const eventCard = page.getByTestId("event-reference-card");
  await expect(eventCard).toHaveCount(1);
  await eventCard.getByRole("button", { name: "В избранное" }).click();
  await expect(eventCard.getByRole("button", { name: "Убрать из избранного" })).toHaveAttribute("aria-pressed", "true");
  const duration = await eventCard.evaluate(el => getComputedStyle(el).transitionDuration);
  expect(duration).not.toBe("0s");
  await page.getByRole("textbox", { name: "Поиск событий" }).fill("нет такого мероприятия");
  await expect(page.getByText("События не найдены")).toBeVisible();
  await page.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(eventCard).toHaveCount(1);
  await page.getByRole("button", { name: "Список" }).click();
  await expect(page).toHaveURL(/view=list/);
});
