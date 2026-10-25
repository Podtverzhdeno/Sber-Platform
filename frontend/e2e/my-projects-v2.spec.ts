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
  decisions: [], allowed_artifacts: ["git-commit", "report"],
}));
async function fixture(page: Page, requestedView: "cards" | "list" = "cards") {
  await page.clock.setFixedTime(new Date("2026-10-25T12:00:00Z"));
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
      customer:{id:"customer-"+String(index),display_name:project.customer},
      mentor:{id:"mentor-1",display_name:"Мария Волкова"},
      team:[{person_id:actor.person_id,display_name:actor.display_name,status:"in_progress"},{person_id:"mentor-1",display_name:"Мария Волкова",status:"mentor"}],
      checkpoints:["Исследование требований","Прототип","Тестирование","Документация","Финальный отчёт"].map((title,i)=>({key:"cp-"+String(i),title,status:i<project.completed?"completed":"pending"})),
      personal:[],feedback:[],problem:"Реальный исследовательский проект",
    }});
  });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  if ((page.viewportSize()?.width ?? 1024) < 1024) {
    await page.getByRole("button", { name: "Меню", exact: true }).click();
  }
  await page.getByRole("link",{name:"Мои проекты"}).click();
  await expect(page.locator(".mpv2")).toBeVisible();
  if (requestedView === "cards") {
    await page.locator(".mpv2").getByRole("group", { name: "Режим проектов" }).getByRole("button", { name: "Карточки" }).click();
  }
}

test("My Projects: default layout is list and manual cards choice remains available",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page, "list");
  const root=page.locator(".mpv2");
  await expect(root).toHaveAttribute("data-project-screen","list");
  await expect(root.locator(".mp-table tbody tr")).toHaveCount(3);
  await expect(root.getByRole("group",{name:"Режим проектов"}).getByRole("button",{name:"Список"})).toHaveAttribute("aria-pressed","true");
  await root.getByRole("group",{name:"Режим проектов"}).getByRole("button",{name:"Карточки"}).click();
  await expect(root).toHaveAttribute("data-project-screen","cards");
  await expect(page).toHaveURL(/layout=cards/);
  await page.reload();
  await expect(page.locator(".mpv2")).toHaveAttribute("data-project-screen","cards");
});

test("My Projects: cards, selection, filtering, bookmarks and rewards",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  const root=page.locator(".mpv2");
  await expect(root).toHaveAttribute("data-project-screen","cards");
  await expect(root.locator(".mp-project-tile")).toHaveCount(3);
  await expect(root.locator(".mpr-stage")).toHaveCount(6);
  await expect(root.locator(".mp-card-list .mp-project-tile")).toHaveCount(3);
  await expect(root.locator(".mp-project-tile__identity small").first()).toContainText("Сбер");
  await expect(root.locator(".mp-preview")).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/01_cards_1672.png",fullPage:true,animations:"disabled"});
  await root.locator(".mp-project-tile").first().hover();
  await expect(root.locator(".mp-project-tile").first()).toBeVisible();
  await root.getByRole("button",{name:/В избранное/}).first().click();
  await expect(root.getByRole("button",{name:/Убрать из избранного/})).toHaveCount(1);
  await root.getByRole("button",{name:/На ревью \(1\)/}).click();
  await expect(root.locator(".mp-project-tile")).toHaveCount(1);
  await root.getByRole("button",{name:/Все проекты \(3\)/}).click();
  await root.getByLabel("Компания",{exact:true}).selectOption("Т-Банк");
  await expect(root.locator(".mp-project-tile")).toHaveCount(1);
  await root.getByLabel("Компания",{exact:true}).selectOption("all");
  await expect(root.locator(".mp-project-tile")).toHaveCount(3);
  await root.getByRole("button",{name:/Токены GigaCode/}).first().click();
  await expect(page.getByRole("dialog", { name: "Награда: Токены GigaCode" })).toBeVisible();
  await page.getByRole("button",{name:"Закрыть информацию о бонусе"}).click();
  await root.getByRole("textbox",{name:"Поиск проектов"}).fill("не существует");
  await expect(root.locator(".mp-project-tile")).toHaveCount(0);
  await root.getByRole("textbox",{name:"Поиск проектов"}).fill("");
  await expect(root.locator(".mp-project-tile")).toHaveCount(3);
});
test("My Projects: list has genuine rows and opens full project page",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page, "list");
  const root=page.locator(".mpv2");
  await root.getByRole("group",{name:"Режим проектов"}).getByRole("button",{name:"Список"}).click();
  await expect(root).toHaveAttribute("data-project-screen","list");
  await expect(root.locator(".mp-table tbody tr")).toHaveCount(3);
  await page.screenshot({path:"test-results/my-projects-v2/02_list_1672.png",fullPage:true,animations:"disabled"});
  await root.locator(".mp-table-open").first().click();
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/03_detail_1672.png",fullPage:true,animations:"disabled"});
  await expect(page.getByRole("tab",{name:"Бонусы и выгоды"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Ключевая информация"})).toBeVisible();
  await expect(page.locator(".mp-overview-layout > .mp-detail-stack")).toHaveCount(2);
  await page.getByRole("tab",{name:"Команда"}).click();
  await expect(page.getByRole("heading",{name:"Команда проекта"})).toBeVisible();
  await page.getByRole("tab",{name:"Мой вклад"}).click();
  await expect(page.getByRole("heading",{name:"Мой личный вклад"})).toBeVisible();
  await page.getByRole("tab",{name:"Бонусы и выгоды"}).click();
  await expect(page.locator(".mp-ref-rewards button")).toHaveCount(6);
  await page.getByRole("button",{name:/Результат в портфолио/}).last().click();
  await expect(page.locator(".mp-ref-reward-note")).toBeVisible();
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
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  const tile=page.locator(".mp-project-tile").nth(1);
  await expect(tile).toBeVisible();
  const initial=await tile.evaluate(node=>getComputedStyle(node).transform);
  const duration=await tile.evaluate(node=>getComputedStyle(node).transitionDuration);
  expect(duration).not.toBe("0s");
  await tile.hover();
  await expect.poll(()=>tile.evaluate(node=>getComputedStyle(node).transform)).not.toBe(initial);
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
  await page.locator(".mp-detail-footer").getByRole("button",{name:"Перейти к задачам"}).click();
  await expect(page.locator('[data-project-screen="dashboard"]')).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/04_dashboard_1672.png",fullPage:true,animations:"disabled"});
  await expect(page.getByRole("heading",{name:"Этапы проекта"})).toBeVisible();
  await expect(page.getByRole("img",{name:"Выполнено 60%"})).toBeVisible();
  await expect(page.getByText("Условия проекта · версия 1")).toBeVisible();
  await page.getByRole("button",{name:"Подробнее",exact:true}).click();
  const info=page.getByRole("dialog",{name:"Подробнее о проекте"});
  await expect(info).toBeVisible();
  await expect(info.getByText("Какую проблему решаем")).toBeVisible();
  await expect(info.getByText("Что заказчик хочет получить")).toBeVisible();
  await expect(info.locator(".mpd-criteria li").filter({hasText:"Исследование требований"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(info).toHaveCount(0);
  await page.getByRole("button",{name:"Этапы",exact:true}).click();
  await expect(page.getByRole("button",{name:"Назад к обзору"})).toBeVisible();
  await page.getByRole("button",{name:"Назад к обзору"}).click();
  await page.getByRole("button",{name:"Сдать решение по этапу"}).click();
  const checkpoint=page.getByTestId("checkpoint-solution-popup");
  await expect(checkpoint).toBeVisible();
  await expect(checkpoint).toContainText("Документация");
  await checkpoint.getByRole("button",{name:"Закрыть чекпоинт"}).click();
  await expect(checkpoint).toHaveCount(0);
});

test("My Projects: reference desktop grid and contextual help",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  const root=page.locator(".mpv2");
  const layout=root.locator(".mp-card-layout");
  await expect(layout.locator(".mp-card-list .mp-project-tile")).toHaveCount(3);
  const columns=await layout.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  expect(columns).toBe(2);
  const help=root.getByRole("button",{name:"Как это работает?"});
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded","true");
  await expect(root.getByRole("region",{name:"Как работают мои проекты"})).toBeVisible();
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded","false");
});

test("My Projects: quick preview tabs open correct deep-linked details",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  const root=page.locator(".mpv2");
  await root.locator(".mp-preview__tabs").getByRole("button",{name:"Прогресс"}).click();
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
  await expect(page.getByRole("tab",{name:"Прогресс"})).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("heading",{name:"Прогресс выполнения проекта"})).toBeVisible();
  await page.getByRole("button",{name:"Закрыть подробности проекта"}).click();
  await root.locator(".mp-preview__tabs").getByRole("button",{name:"Бонусы и выгоды"}).click();
  await expect(page.getByRole("tab",{name:"Бонусы и выгоды"})).toHaveAttribute("aria-selected","true");
  await expect(page.locator(".mp-ref-rewards button")).toHaveCount(6);
});

test("My Projects: writing to a teammate targets the selected participant",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  await page.getByRole("tab",{name:"Команда"}).click();
  await expect(page.locator(".mp-ref-person")).toHaveCount(2);
  await page.locator(".mp-ref-person").nth(1).getByRole("button",{name:/Написать/}).click();
  await expect(page).toHaveURL(/participant=mentor-1/);
  await expect(page).toHaveURL(/task=task-assignment-1/);
});

test("My Projects: compact reference cards show real team and no duplicated benefit strip",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  const cards=page.locator(".mp-card-list .mp-project-tile");
  await expect(cards).toHaveCount(3);
  await expect(cards.first().locator(".mp-team-avatars i")).toHaveCount(2);
  await expect(cards.first().locator(".mp-project-card-rewards")).toHaveCount(0);
  await expect(cards.first()).toHaveClass(/is-selected/);
  const box=await cards.first().boundingBox();
  if(!box) throw new Error("Project card bounding box is unavailable");
  expect(box.height).toBeLessThanOrEqual(175);
  await cards.nth(1).getByRole("button",{name:/Выбрать проект/}).click();
  await expect(page.locator(".mp-preview__header h2")).toContainText("MVP чат-ассистента");
  await cards.first().getByRole("button",{name:/Выбрать проект/}).click();
  await expect(page.locator(".mp-preview__header h2")).toContainText("Прототип рекомендательной");
});

test("My Projects: deadline selection filters cards and list consistently",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  const projects=page.locator(".mpv2");
  const deadline=projects.getByRole("combobox",{name:"Сроки"});
  await deadline.selectOption("month");
  await expect(projects.locator(".mp-project-tile")).toHaveCount(0);
  await deadline.selectOption("all");
  await expect(projects.locator(".mp-project-tile")).toHaveCount(3);
  await deadline.selectOption("overdue");
  await expect(projects.locator(".mp-project-tile")).toHaveCount(0);
  await projects.getByRole("group",{name:"Режим проектов"}).getByRole("button",{name:"Список"}).click();
  await expect(projects.locator(".mp-table tbody tr")).toHaveCount(0);
  await deadline.selectOption("all");
  await expect(projects.locator(".mp-table tbody tr")).toHaveCount(3);
});

test("My Projects: contribution upload uses allowed artifact key and real API payload",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  let posted: { personal_summary?: string; artifacts?: {key:string;uri:string}[] } | null = null;
  await fixture(page);
  await page.route("**/api/v1/me/assignments/assignment-1/contributions",async route=>{
    posted=route.request().postDataJSON() as {personal_summary:string;artifacts:{key:string;uri:string}[]};
    await route.fulfill({status:201,json:{id:"contribution-new",assignment_id:"assignment-1",version:2,personal_summary:posted.personal_summary,artifact_keys:["report"],status:"reported"}});
  });
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  await page.getByRole("tab",{name:"Мой вклад"}).click();
  const form=page.locator(".mp-contribute-form");
  await expect(form.getByRole("combobox",{name:"Тип доказательства"})).toBeVisible();
  await form.getByRole("combobox",{name:"Тип доказательства"}).selectOption("report");
  await form.locator("textarea").fill("Подготовил воспроизводимую проверку результатов и оформил отчёт по эксперименту");
  await form.getByRole("textbox",{name:"Ссылка на доказательство"}).fill("https://example.org/reports/final");
  await form.getByRole("button",{name:"Отправить вклад"}).click();
  await expect.poll(()=>posted).not.toBeNull();
  expect(posted).toMatchObject({
    artifacts:[{key:"report",uri:"https://example.org/reports/final"}],
  });
});

test("Project information popup is read-only, detailed, responsive and dismissible",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page);
  await page.locator(".mp-card-list .mp-open-tile").first().click();
  await page.locator(".mp-detail-footer").getByRole("button",{name:"Перейти к задачам"}).click();
  const dashboard=page.locator('[data-project-screen="dashboard"]');
  await expect(dashboard).toBeVisible();
  await dashboard.getByRole("button",{name:"Подробнее",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Подробнее о проекте"});
  await expect(dialog).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/05_popup_1672.png",fullPage:false,animations:"disabled"});
  await expect(dialog.getByText("Реальный исследовательский проект")).toBeVisible();
  await expect(dialog.getByRole("heading",{name:"Подробнее о проекте"})).toBeVisible();
  await expect(dialog.getByText("Версия условий")).toBeVisible();
  await expect(dialog.locator(".mpd-criteria li")).toHaveCount(5);
  await expect(dialog.getByRole("heading",{name:"План выполнения"})).toBeVisible();
  await expect(dialog.locator(".mpd-info-checkpoints li")).toHaveCount(5);
  await expect(dialog.getByRole("heading",{name:"Требуемые навыки и форматы"})).toBeVisible();
  await expect(dialog.getByText("Заказчик",{exact:true})).toBeVisible();
  await expect(dialog.getByText("Сбер",{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Закрыть подробности о проекте"}).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button",{name:"Вернуться к работе"})).toBeFocused();
  await dialog.getByRole("button",{name:"Вернуться к работе"}).click();
  await expect(dialog).toHaveCount(0);
  await expect(dashboard).toBeVisible();
});

test("Project dashboard and detailed popup remain usable on a narrow phone",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await fixture(page);
  await page.locator(".mp-card-list .mp-open-tile").first().click();
  await page.locator(".mp-detail-footer").getByRole("button",{name:"Перейти к задачам"}).click();
  const dashboard=page.locator('[data-project-screen="dashboard"]');
  await expect(dashboard).toBeVisible();
  await dashboard.getByRole("button",{name:"Подробнее",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Подробнее о проекте"});
  await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox();
  if(!box)throw new Error("Popup was not rendered");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  await dialog.getByRole("button",{name:"Закрыть подробности о проекте"}).click();
  await expect(dialog).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});


test("pixel-reference tabs remain interactive at 1548×1016",async({page})=>{
  test.setTimeout(75_000);
  await page.setViewportSize({width:1548,height:1016});
  await fixture(page);
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  const detail=page.locator('[data-project-screen="detail"]');
  await expect(detail.locator(".mp-ref-hero")).toBeVisible();
  const fullCanvas=await detail.boundingBox();
  if(!fullCanvas)throw new Error("Project reference canvas is missing");
  expect(Math.abs(fullCanvas.x-28)).toBeLessThanOrEqual(1);
  expect(Math.abs(fullCanvas.y-12)).toBeLessThanOrEqual(1);
  expect(Math.abs(fullCanvas.width-1492)).toBeLessThanOrEqual(2);
  expect(Math.abs(fullCanvas.height-992)).toBeLessThanOrEqual(2);
  const cases=[
    ["Задачи","01_tasks",".mp-ref-task-list"],
    ["Прогресс","02_progress",".mp-ref-progress-summary"],
    ["Мой вклад","03_contribution",".mp-ref-contrib-metrics"],
    ["Команда","04_team",".mp-ref-team-list"],
    ["Бонусы и выгоды","05_rewards",".mp-ref-rewards"],
  ] as const;
  for(const [name,filename,selector] of cases){
    const tab=detail.getByRole("tab",{name,exact:true});
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected","true");
    await expect(detail.locator(selector)).toBeVisible();
    const outside=await detail.evaluate(node=>node.scrollWidth>node.clientWidth+2);
    expect(outside).toBe(false);
    await page.screenshot({path:`test-results/my-projects-v2/ref_${filename}_1548.png`,fullPage:false,animations:"disabled"});
  }
  await detail.getByRole("tab",{name:"Задачи"}).click();
  const filter=detail.getByRole("button",{name:/В работе ·/});
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed","true");
  await detail.getByRole("tab",{name:"Бонусы и выгоды"}).click();
  await detail.getByRole("button",{name:/Результат в портфолио/}).click();
  await expect(detail.locator(".mp-ref-reward-note")).toBeVisible();

  const timelineCircles=await detail.locator(".mp-ref-timeline .mp-ref-stage > span:first-child")
    .evaluateAll(elements=>elements.map(node=>{
      const rect=node.getBoundingClientRect();
      return {width:rect.width,height:rect.height,radius:getComputedStyle(node).borderRadius};
    }));
  expect(timelineCircles.length).toBe(4);
  for(const circle of timelineCircles){
    expect(Math.abs(circle.width-circle.height)).toBeLessThanOrEqual(1);
    expect(circle.width).toBeGreaterThanOrEqual(26);
    expect(circle.radius).toBe("50%");
  }

});


test("My Projects: golden Skill Passport details and all rewards are interactive",async({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await fixture(page,"list");
  const root=page.locator(".mpv2");
  await expect(root.locator(".mpr-stage")).toHaveCount(6);
  await expect(root.locator(".mpr-perk")).toHaveCount(2);
  await expect(root.locator(".mpr-stage--green")).toContainText("Стать ментором");
  await expect(root.locator(".mpr-golden")).toBeVisible();
  const passportButton=root.getByRole("button",{name:"Skill Passport. Узнать подробнее"});
  await passportButton.click();
  const dialog=page.getByRole("dialog",{name:"Skill Passport"});
  await expect(dialog).toBeVisible();
  const closeGeometry=await dialog.getByRole("button",{name:"Закрыть информацию о бонусе"}).evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return {width:rect.width,height:rect.height,borderRadius:getComputedStyle(element).borderRadius};
  });
  expect(Math.abs(closeGeometry.width-closeGeometry.height)).toBeLessThanOrEqual(1);
  expect(closeGeometry.borderRadius).toBe("50%");
  await expect(dialog.getByText("Признание среди работодателей")).toBeVisible();
  await expect(dialog.getByText("Приоритетное внимание к кандидатуре")).toBeVisible();
  await expect(dialog.getByText("Ускоренный карьерный рост")).toBeVisible();
  await expect(dialog.getByText("Эксклюзивные рабочие возможности")).toBeVisible();
  await expect(dialog.getByText(/Логотипы не означают партнёрство/)).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/05_passport_1672.png",animations:"disabled"});
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(passportButton).toBeFocused();

  for(const title of ["Токены GitVerse","Токены GigaCode","Премиум GigaAgent",
    "Возможность стажировки в Сбере","Закрытое сообщество лучших","Стать ментором"]){
    await root.getByRole("button",{name:new RegExp(title)}).first().click();
    const rewardDialog=page.getByRole("dialog",{name:new RegExp("Награда: "+title)});
    await expect(rewardDialog).toBeVisible();
    await expect(rewardDialog.getByText("Что ты получаешь")).toBeVisible();
    await rewardDialog.getByRole("button",{name:"Понятно"}).click();
    await expect(rewardDialog).toHaveCount(0);
  }
  for(const title of ["Оценка личного вклада","Пополнение портфолио"]){
    await root.locator(".mpr-perk").filter({hasText:title}).click();
    await expect(page.getByRole("dialog",{name:"Награда: "+title})).toBeVisible();
    await page.keyboard.press("Escape");
  }
});

test("My Projects: reward area and modal fit on 390px mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await fixture(page,"list");
  const root=page.locator(".mpv2");
  await expect(root.locator(".mpr-stage")).toHaveCount(6);
  const overflows=await root.evaluate(element=>element.scrollWidth-element.clientWidth);
  expect(overflows).toBeLessThanOrEqual(2);
  await root.getByRole("button",{name:"Skill Passport. Узнать подробнее"}).click();
  const dialog=page.getByRole("dialog",{name:"Skill Passport"});
  await expect(dialog).toBeVisible();
  const bounds=await dialog.boundingBox();
  if(!bounds)throw new Error("Passport modal is missing");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
  await dialog.getByRole("button",{name:"Понятно"}).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button",{name:"Понятно"})).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/06_passport_mobile.png",animations:"disabled"});
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});


test("reference project controls have distinct effects and accessible keyboard navigation",async({page})=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width:1548,height:1016});
  await fixture(page);
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  const detail=page.getByRole("dialog",{name:"Прототип рекомендательной системы для научных статей"});
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("button",{name:"Закрыть подробности проекта"})).toBeFocused();
  await expect(detail.locator(".mp-ref-hero-art--research")).toBeVisible();
  await expect(detail.locator(".mp-ref-hero-art--satellite")).toHaveCount(0);
  const logo=detail.locator(".mp-ref-hero .mp-company-mark img");
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>=64)).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(detail.locator(".mp-detail-footer button").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(detail.getByRole("button",{name:"Закрыть подробности проекта"})).toBeFocused();

  await detail.getByRole("tab",{name:"Задачи"}).click();
  await expect(page).toHaveURL(/tab=tasks/);
  await detail.getByRole("button",{name:/В работе ·/}).click();
  await expect(detail.getByRole("button",{name:/В работе ·/})).toHaveAttribute("aria-pressed","true");
  await detail.getByRole("button",{name:/Все задачи ·/}).click();
  await detail.locator(".mp-ref-task-row").nth(4).click();
  await expect(detail.locator(".mp-ref-current")).toContainText("Финальный отчёт");

  await detail.getByRole("tab",{name:"Команда"}).click();
  await expect(page).toHaveURL(/tab=team/);
  await expect(detail.locator(".mp-ref-team-list")).toContainText("Ментор");
  await expect(detail.locator(".mp-ref-team-count")).toContainText("1 участник");
  await detail.getByRole("tab",{name:"Бонусы и выгоды"}).click();
  await expect(page).toHaveURL(/tab=rewards/);
  const expected=[
    ["Результат в портфолио","Только принятый результат"],
    ["Развитие компетенций","Уровень компетенций"],
    ["Менторская поддержка","Ментор назначен"],
    ["Реальный кейс","исходную задачу"],
    ["Командная практика","фактическим участием"],
    ["Рекомендации и возможности","не означает автоматической"],
  ] as const;
  for(const [title,description] of expected){
    await detail.locator(".mp-ref-rewards").getByRole("button",{name:new RegExp(title)}).click();
    const explanation=detail.locator(".mp-ref-reward-note");
    await expect(explanation).toContainText(title);
    await expect(explanation).toContainText(description);
  }
  await detail.getByRole("tab",{name:"Мой вклад"}).click();
  await expect(page).toHaveURL(/tab=contribution/);
  await expect(detail.locator(".mp-contribute-form")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(page).not.toHaveURL(/project=assignment-1/);
});

test("all five project detail tabs fit small screens without horizontal overflow",async({page})=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width:390,height:844});
  await fixture(page);
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  const detail=page.locator('[data-project-screen="detail"]');
  for(const title of ["Задачи","Прогресс","Мой вклад","Команда","Бонусы и выгоды"]){
    await detail.getByRole("tab",{name:title}).click();
    const diff=await detail.evaluate(node=>node.scrollWidth-node.clientWidth);
    expect(diff).toBeLessThanOrEqual(2);
    const docOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(docOverflow).toBeLessThanOrEqual(2);
  }
});


test("satellite reference asset is sharp and vector brand marks load",async({page})=>{
  await page.setViewportSize({width:1548,height:1016});
  await fixture(page);
  const response=await page.request.get(new URL("/my-projects/astra-orbit.svg",page.url()).toString());
  expect(response.ok()).toBe(true);
  const content=await response.text();
  expect(content).toContain('viewBox="0 0 595 220"');
  const embedded=content.match(/data:image\/webp;base64,([^"]+)/)?.[1];
  if(!embedded)throw new Error("Expected a high-quality embedded satellite image");
  const bytes=Buffer.from(embedded,"base64");
  expect(bytes.length).toBeGreaterThan(30000);
  expect(bytes.subarray(8,12).toString("ascii")).toBe("WEBP");
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  const modal=page.getByRole("dialog",{name:"Прототип рекомендательной системы для научных статей"});
  await expect(modal.locator(".mp-ref-hero-art--research")).toBeVisible();
  await expect(modal.locator(".mp-ref-hero-art--satellite")).toHaveCount(0);
  const logo=modal.locator(".mp-ref-hero .mp-company-mark img");
  expect(await logo.getAttribute("src")).toMatch(/\.svg$/);
  expect(await logo.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>=64)).toBe(true);
});


test("sharing the active tab creates a useful deep link and handles clipboard failures",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
      writeText:(value:string)=>{sessionStorage.setItem("qa-copied-project-link",value);return Promise.resolve();}
    }});
  });
  await page.setViewportSize({width:1548,height:1016});
  await fixture(page);
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  const detail=page.getByRole("dialog",{name:/Прототип рекомендательной системы/});
  await detail.getByRole("tab",{name:"Команда"}).click();
  await expect(page).toHaveURL(/tab=team/);
  await detail.getByRole("button",{name:"Поделиться"}).click();
  await expect(detail.getByRole("button",{name:"Ссылка скопирована"})).toBeVisible();
  const copied=await page.evaluate(()=>sessionStorage.getItem("qa-copied-project-link"));
  expect(copied).toContain("project=assignment-1");
  expect(copied).toContain("tab=team");
  await page.evaluate(()=>{
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
      writeText:()=>Promise.reject(new Error("Clipboard blocked")),
    }});
  });
  await detail.getByRole("button",{name:"Ссылка скопирована"}).click();
  await expect(detail.getByRole("button",{name:"Не удалось скопировать"})).toBeVisible();
});


test("checkpoint popup stores binary file and submits stage-specific contribution",async({page})=>{
  test.setTimeout(95_000);
  await page.setViewportSize({width:1548,height:1016});
  const uploaded:{filename:string;content_type:string;base64_data:string}[]=[];
  const submissions:{summary:string;artifact_key:string;file_ids:string[];external_url:string|null}[]=[];
  let stageHistory:{checkpoint_key:string;contribution_id:string;version:number;status:string}[]=[];
  await fixture(page);
  await page.route("**/api/v1/me/assignments/assignment-1/checkpoint-submissions",route=>
    route.fulfill({json:stageHistory}));
  await page.route("**/api/v1/me/assignments/assignment-1/checkpoints/cp-3/files",route=>{
    uploaded.push(route.request().postDataJSON() as (typeof uploaded)[number]);
    return route.fulfill({status:200,json:{id:"00000000-0000-0000-0000-000000000221",filename:"prototype.txt",size_bytes:34}});
  });
  await page.route("**/api/v1/me/assignments/assignment-1/checkpoints/cp-3/submit",route=>{
    const payload=route.request().postDataJSON() as (typeof submissions)[number];
    submissions.push(payload);
    stageHistory=[{checkpoint_key:"cp-3",contribution_id:"00000000-0000-0000-0000-000000000222",version:2,status:"submitted"}];
    return route.fulfill({status:200,json:{id:"00000000-0000-0000-0000-000000000222",assignment_id:"assignment-1",version:2,personal_summary:payload.summary,artifact_keys:["report"],status:"submitted"}});
  });
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  const first=page.getByTestId("project-next-action");
  await expect(first).toContainText("Документация");
  await first.getByRole("button",{name:/Открыть задачу этапа/}).click();
  const popup=page.getByTestId("checkpoint-solution-popup");
  await expect(popup).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/05_checkpoint_desktop.png",fullPage:true,animations:"disabled"});
  await expect(popup).toContainText("ЧЕКПОИНТ 4 / 5");
  await expect(popup).toContainText("Документация");
  const send=popup.getByRole("button",{name:/Отправить на проверку/});
  await expect(send).toBeDisabled();
  await popup.getByRole("textbox",{name:/Что ты сделал лично/}).fill(
    "Подготовил документацию прототипа, проверил шаги воспроизведения и сохранил результаты исследования.",
  );
  await popup.locator('input[type="file"]').setInputFiles({
    name:"prototype.txt",mimeType:"text/plain",
    buffer:Buffer.from("Demonstration experiment and research."),
  });
  await expect(popup).toContainText("prototype.txt");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(popup).toContainText("Решение отправлено");
  await expect.poll(()=>uploaded.length).toBe(1);
  await expect.poll(()=>submissions.length).toBe(1);
  expect(uploaded[0]?.filename).toBe("prototype.txt");
  expect(uploaded[0]?.content_type).toBe("text/plain");
  expect(submissions[0]?.file_ids).toEqual(["00000000-0000-0000-0000-000000000221"]);
  expect(submissions[0]?.summary).toContain("Подготовил документацию");
  await popup.getByRole("button",{name:/Вернуться к проекту/}).first().click();
  await expect(popup).toHaveCount(0);
});

test("checkpoint popup validates attachments and supports Escape on a narrow screen",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await fixture(page);
  await page.route("**/api/v1/me/assignments/assignment-1/checkpoint-submissions",route=>
    route.fulfill({json:[]}));
  await page.locator(".mp-project-tile").first().getByRole("button",{name:/Продолжить|Открыть/}).click();
  await page.getByTestId("project-next-action").getByRole("button",{name:/Открыть задачу этапа/}).click();
  const popup=page.getByTestId("checkpoint-solution-popup");
  await expect(popup).toBeVisible();
  await page.screenshot({path:"test-results/my-projects-v2/06_checkpoint_mobile.png",fullPage:true,animations:"disabled"});
  await popup.locator('input[type="file"]').setInputFiles({
    name:"run.exe",mimeType:"application/octet-stream",buffer:Buffer.from("blocked"),
  });
  await expect(popup.getByRole("alert")).toContainText("PDF, PNG, JPG, TXT и ZIP");
  const box=await popup.boundingBox();
  if(!box)throw new Error("Popup has no bounding box");
  expect(box.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
});
