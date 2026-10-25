import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [], consent_scopes: [],
  navigation: ["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения","AI-Buddy","Настройки"],
  csrf_token: "csrf-test-projects",
};
const projects = [
  { id: "assignment-1", title: "Прототип рекомендательной системы для научных статей", status: "in_progress", customer: "Сбер", deadline: "2026-11-25T11:00:00Z", completed: 3 },
  { id: "assignment-2", title: "MVP чат-ассистента для внутренних знаний", status: "submitted", customer: "Т-Банк", deadline: "2026-11-30T11:00:00Z", completed: 4 },
  { id: "assignment-3", title: "Исследование методов сжатия изображений", status: "closed", customer: "Astra", deadline: "2026-12-05T11:00:00Z", completed: 5 },
];
const work = projects.map(item=>({
  assignment: { id:item.id, task_id:`task-${item.id}`, person_id:actor.person_id, status:item.status },
  task: { id:`task-${item.id}`, title:item.title, status:item.status },
  terms: { version:1, deadline_at:item.deadline, deliverable:`Реализовать: ${item.title}`, acceptance_criteria:["Исследование требований","Прототип","Тестирование","Документация","Финальный отчёт"] },
  contributions: item.status==="in_progress" ? [{ id:"contribution-1", version:1, personal_summary:"Подготовлен воспроизводимый модуль рекомендаций", artifact_keys:[], status:"reported" }] : [],
  decisions: [], allowed_artifacts: [],
}));
async function fixture(page: Page) {
  let authenticated=false;
  await page.route("**/api/v1/config", route=>route.fulfill({json:{demo_mode:true,honor_board_enabled:false}}));
  await page.route("**/api/v1/auth/personas", route=>route.fulfill({json:[{key:"participant-alex",display_name:actor.display_name,roles:["participant"]}]}));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route => authenticated ? route.fulfill({json:actor}) : route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/demo-login", route=>{authenticated=true;return route.fulfill({json:actor});});
  await page.route("**/api/v1/me/work",route=>route.fulfill({json:work}));
  await page.route(/\/api\/v1\/me\/tasks\/task-assignment-[0-9]+$/,route=>{
    const index = projects.findIndex(project=>route.request().url().endsWith("task-"+project.id));
    const project=projects[Math.max(0,index)];
    return route.fulfill({json:{
      task:{id:"task-"+project.id,title:project.title},
      customer:{id:"customer-"+index,display_name:project.customer},
      mentor:{id:"mentor-1",display_name:"Мария Волкова"},
      team:[{person_id:actor.person_id,display_name:actor.display_name,status:"in_progress"},{person_id:"mentor-1",display_name:"Мария Волкова",status:"mentor"}],
      checkpoints:["Исследование требований","Прототип","Тестирование","Документация","Финальный отчёт"].map((title,i)=>({key:"cp-"+i,title,status:i<project.completed?"completed":"pending"})),
      personal:[],feedback:[],problem:"Реальный исследовательский проект",
    }});
  });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  if (page.viewportSize() && page.viewportSize()!.width < 1024) {
    await page.getByRole("button", { name: "Меню", exact: true }).click();
  }
  await page.getByRole("link",{name:"Мои проекты"}).click();
  await expect(page.locator(".mpv2")).toBeVisible();
}

test("My Projects: cards, selection, filtering, bookmarks and rewards",async({page})=>{
  await page.setViewportSize({width:1648,height:941});
  await fixture(page);
  const root=page.locator(".mpv2");
  await expect(root).toHaveAttribute("data-project-screen","cards");
  await expect(root.locator(".mp-project-tile")).toHaveCount(3);
  await expect(root.locator(".mp-benefit-step")).toHaveCount(7);
  await expect(root.locator(".mp-preview")).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/01_cards_1648.png",fullPage:true,animations:"disabled"});
  await root.locator(".mp-project-tile").first().hover();
  await expect(root.locator(".mp-project-tile").first()).toBeVisible();
  await root.getByRole("button",{name:/В избранное/}).first().click();
  await expect(root.getByRole("button",{name:/Убрать из избранного/})).toHaveCount(1);
  await root.getByRole("button",{name:/На ревью \(1\)/}).click();
  await expect(root.locator(".mp-project-tile")).toHaveCount(1);
  await root.getByRole("button",{name:/Все проекты \(3\)/}).click();
  await root.getByRole("button",{name:/Токены GigaCode/}).first().click();
  await expect(root.locator(".mp-reward-popup")).toBeVisible();
  await root.getByRole("button",{name:"Закрыть информацию о бонусе"}).click();
  await root.getByRole("textbox",{name:"Поиск проектов"}).fill("не существует");
  await expect(root.locator(".mp-project-tile")).toHaveCount(0);
  await root.getByRole("textbox",{name:"Поиск проектов"}).fill("");
  await expect(root.locator(".mp-project-tile")).toHaveCount(3);
});
test("My Projects: list has genuine rows and opens full project page",async({page})=>{
  await page.setViewportSize({width:1648,height:941});
  await fixture(page);
  const root=page.locator(".mpv2");
  await root.getByRole("group",{name:"Режим проектов"}).getByRole("button",{name:"Список"}).click();
  await expect(root).toHaveAttribute("data-project-screen","list");
  await expect(root.locator(".mp-table tbody tr")).toHaveCount(3);
  await page.screenshot({path:"test-results/my-projects-v2/02_list_1648.png",fullPage:true,animations:"disabled"});
  await root.locator(".mp-table-open").first().click();
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/03_detail_1648.png",fullPage:true,animations:"disabled"});
  await expect(page.getByRole("tab",{name:"Бонусы и выгоды"})).toBeVisible();
  await page.getByRole("tab",{name:"Команда"}).click();
  await expect(page.getByRole("heading",{name:"Команда проекта"})).toBeVisible();
  await page.getByRole("tab",{name:"Мой вклад"}).click();
  await expect(page.getByRole("heading",{name:"Мой личный вклад"})).toBeVisible();
  await page.getByRole("tab",{name:"Бонусы и выгоды"}).click();
  await expect(page.locator(".mp-rewards-full button")).toHaveCount(7);
  await page.getByRole("button",{name:/Токены GitVerse/}).last().click();
  await expect(page.locator(".mp-reward-notice")).toBeVisible();
  await page.getByRole("button",{name:/Все проекты/}).last().click();
  await expect(root).toHaveAttribute("data-project-screen","list");
  await root.getByRole("group",{name:"Режим проектов"}).getByRole("button",{name:"Карточки"}).click();
  await expect(root).toHaveAttribute("data-project-screen","cards");
});
test("My Projects: mobile three views do not horizontally overflow the viewport",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await fixture(page);
  const root=page.locator(".mpv2");
  await expect(root.locator(".mp-project-tile").first()).toBeVisible();
  await root.getByRole("group",{name:"Режим проектов"}).getByRole("button",{name:"Список"}).click();
  await expect(root.locator(".mp-table")).toBeVisible();
  await root.locator(".mp-table-open").first().click();
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
  const width=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(2);
});

test("My Projects: hover animations and workspace transition are real",async({page})=>{
  await page.setViewportSize({width:1648,height:941});
  await fixture(page);
  const tile=page.locator(".mp-project-tile").nth(1);
  await expect(tile).toBeVisible();
  const initial=await tile.evaluate(node=>getComputedStyle(node).transform);
  const duration=await tile.evaluate(node=>getComputedStyle(node).transitionDuration);
  expect(duration).not.toBe("0s");
  await tile.hover();
  await expect.poll(()=>tile.evaluate(node=>getComputedStyle(node).transform)).not.toBe(initial);
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Открыть/}).click();
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
  await page.getByRole("button",{name:/Продолжить работу/}).click();
  await expect(page.locator(".mpv2--workspace")).toBeVisible();
  await page.getByRole("button",{name:"К странице проекта"}).click();
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
});
