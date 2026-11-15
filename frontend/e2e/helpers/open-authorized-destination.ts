import { expect, type Page } from "@playwright/test";

/**
 * Navigate as a real authorized actor in the approved floating Impulse shell.
 *
 * The former persistent nav links and visible "Меню" trigger were removed.
 * Keep this helper limited to browser fixtures; section identities still come
 * exclusively from the demo actor's server-authorized navigation array.
 */
export async function openAuthorizedDestination(
  page: Page,
  label: string,
  group?: string,
): Promise<void> {
  await page.getByRole("button", { name: "Impulse — открыть разделы" }).click();
  const drawer = page.getByRole("dialog", { name: "Главное меню" });
  await expect(drawer).toBeVisible();

  if (group) {
    const groupTrigger = drawer.getByRole("button", { name: group, exact: true });
    await expect(groupTrigger).toBeVisible();
    if (await groupTrigger.getAttribute("aria-expanded") !== "true") {
      await groupTrigger.click();
    }
    await expect(groupTrigger).toHaveAttribute("aria-expanded", "true");
  }

  const route = drawer.getByRole("link", { name: label, exact: true });
  await expect(route).toBeVisible();
  await route.click();
  await expect(drawer).toBeHidden();
}
