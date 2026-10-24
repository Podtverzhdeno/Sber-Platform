import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Сообщения", "Задачи"],
  csrf_token: "messages-reference",
};
const elenaId = "00000000-0000-4000-8000-000000000102";
const mayakiId = "00000000-0000-4000-8000-000000000103";
const teamId = "00000000-0000-4000-8000-000000000104";
const makeMessage = (id: string, body: string, author_name = "Елена Наставник") => ({
  id, author_id: "00000000-0000-4000-8000-000000000005", author_name,
  kind: "text", body, artifact_refs: [], sequence: 1,
  created_at: "2026-10-20T09:14:00Z",
});
const contacts = [
  { id: "00000000-0000-4000-8000-000000000005", display_name: "Елена Наставник", role: "member" },
  { id: actor.person_id, display_name: "Алекс Речной", role: "member" },
];
const channel = (id: string, kind: string, title: string, body: string) => ({
  id,kind,title,status:"active",task_id:kind==="task_team"?"task-01":null,
  role:"member",muted:false,sender_enabled:true,unread:0,participants:contacts,
  last_message:makeMessage("msg-"+id,body),created_at:"2026-10-20T08:00:00Z",
});

async function openMessages(page: Page) {
  let loggedIn = false;
  const channels = [
    channel(elenaId,"personal","Елена Наставник","Отлично! Тогда согласовываем…"),
    channel(mayakiId,"community","Маяки","Календарь мероприятий на осень 2026"),
    channel(teamId,"task_team","Команда задачи","Обновил статусы в задаче"),
  ];
  const sentMessages: string[] = [];
  await page.route("**/api/v1/config", route => route.fulfill({json:{demo_mode:true}}));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json:[{key:"participant-alex",display_name:actor.display_name,roles:["participant"]}],
  }));
  await page.route("**/api/v1/me", route => loggedIn
    ? route.fulfill({json:actor})
    : route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({json:actor});
  });
  await page.route("**/api/v1/me/messaging/channels", route => route.fulfill({json:channels}));
  await page.route("**/api/v1/me/messaging/channels/personal", route => {
    const existing = channels[0];
    return route.fulfill({status:201,json:existing});
  });
  await page.route("**/api/v1/me/messaging/channels/*/messages*", async route => {
    const url = new URL(route.request().url());
    const id = url.pathname.split("/").at(-2);
    if (route.request().method()==="POST") {
      const payload = route.request().postDataJSON() as {body:string};
      sentMessages.push(payload.body);
      return route.fulfill({json:makeMessage("sent-"+String(sentMessages.length),payload.body,"Алекс Речной")});
    }
    return route.fulfill({json:[makeMessage("msg-"+String(id),id===mayakiId?"Календарь мероприятий на осень 2026":id===elenaId?"Привет! Проверь метрики эксперимента":"Задача в работе")]});
  });
  await page.route("**/api/v1/me/messaging/channels/*/mute", route => route.fulfill({json:{...channels[0],muted:true}}));
  await page.route("**/api/v1/me/messaging/channels/*/read", route => route.fulfill({json:channels[0]}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1");
  await expect(page.getByRole("complementary",{name:"Список диалогов"})).toBeVisible();
  return {sentMessages};
}

async function expectRect(page:Page, selector:string, expected:{x:number,y:number,width:number,height:number}, tolerance=8) {
  const actual = await page.locator(selector).boundingBox();
  expect(actual, selector+" must be visible").not.toBeNull();
  for(const key of ["x","y","width","height"] as const) {
    expect(actual?.[key],selector+" "+key).toBeGreaterThanOrEqual(expected[key]-tolerance);
    expect(actual?.[key],selector+" "+key).toBeLessThanOrEqual(expected[key]+tolerance);
  }
}

test("messages empty state uses reference three-column composition at 1448px",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  await openMessages(page);
  await expect(page.getByRole("heading",{name:"Выберите диалог или сообщество"})).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toContainText("Здесь появится контекст диалога");
  await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toContainText("Настройки чата");
  await expect(page.getByRole("button",{name:/Открыть последний чат/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Перейти в Маяки/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Создать новый чат/})).toBeVisible();
  console.log("[MESSAGES_LAYOUT_DEBUG]", JSON.stringify(await page.evaluate(() => {
    const selectors=[".workspace",".workspace-content",".messenger-page",".messenger-shell",".msg-dialog-list",".chat-thread",".msg-reference-context-empty"];
    return selectors.map(selector=>{
      const el=document.querySelector(selector); if(!el)return {selector,missing:true};
      const r=el.getBoundingClientRect(),css=getComputedStyle(el);
      return {selector,x:r.x,y:r.y,width:r.width,height:r.height,display:css.display,position:css.position,flex:css.flex,gridTemplateRows:css.gridTemplateRows,minHeight:css.minHeight,heightCss:css.height,overflow:css.overflow};
    });
  })));
  await expectRect(page,".msg-dialog-list",{x:164,y:70,width:367,height:1016},12);
  await expectRect(page,".chat-thread",{x:531,y:70,width:575,height:1016},14);
  await expectRect(page,".msg-reference-context-empty",{x:1106,y:70,width:298,height:1016},14);
  await expect(page.locator(".msg-reference-empty__bubble.front")).toBeVisible();
  await page.screenshot({path:"test-results/messages-empty-1448.png",fullPage:false});
});

test("quick actions, search, tabs, context, mute, chat input operate end to end",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  const {sentMessages}=await openMessages(page);
  await page.getByRole("button",{name:/Перейти в Маяки/}).click();
  await expect(page.locator(".msg-chat__header-title")).toContainText("Маяки");
  await expect(page.locator(".msg-chat__avatar img")).toHaveAttribute("src","/messages-reference/mayaki-avatar.svg");
  await expect(page.locator(".messenger-page")).toHaveAttribute("data-message-state","community");
  await expectRect(page,".msg-dialog-list",{x:156,y:64,width:334,height:1022},12);
  await expectRect(page,".chat-thread",{x:490,y:64,width:606,height:1022},14);
  await expectRect(page,".msg-context",{x:1096,y:64,width:352,height:1022},14);
  await page.screenshot({path:"test-results/messages-mayaki-1448.png",fullPage:false});
  await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toContainText("Маяки");
  await page.getByRole("button",{name:"Скрыть информацию о чате"}).click();
  await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toHaveCount(0);
  await page.getByRole("button",{name:"Информация о чате"}).click();
  await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toBeVisible();
  await page.getByRole("button",{name:"Скрыть контекст"}).click();
  await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toHaveCount(0);
  await page.getByRole("button",{name:"Открыть контекст"}).click();
  await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toBeVisible();
  await page.getByRole("button",{name:"Отключить уведомления"}).click();
  await page.getByRole("searchbox",{name:"Поиск диалогов"}).fill("Елена");
  await expect(page.getByRole("button",{name:/Елена Наставник/}).first()).toBeVisible();
  await page.getByRole("button",{name:/Елена Наставник/}).first().click();
  await expect(page.locator(".msg-chat__header-title")).toContainText("Елена Наставник");
  const editor=page.getByRole("textbox",{name:"Текст сообщения"});
  await editor.fill("Тест отправки сообщения");
  await editor.press("Enter");
  await expect.poll(()=>sentMessages).toContain("Тест отправки сообщения");
  await page.getByRole("tab",{name:"Архив"}).click();
  await expect(page.getByRole("tab",{name:"Архив"})).toHaveAttribute("aria-selected","true");
  await page.getByRole("tab",{name:/Все/}).click();
  await expect(page.getByRole("tab",{name:/Все/})).toHaveAttribute("aria-selected","true");
});

test("direct chat follows 1672px personal PNG geometry with working editor",async ({page})=>{
  await page.setViewportSize({width:1672,height:941});
  await openMessages(page);
  await page.getByRole("button",{name:/Открыть последний чат/}).click();
  await expect(page.locator(".messenger-page")).toHaveAttribute("data-message-state","direct");
  await expect(page.locator(".msg-chat__header-title")).toContainText("Елена Наставник");
  await expectRect(page,".msg-dialog-list",{x:172,y:69,width:391,height:872},12);
  await expectRect(page,".chat-thread",{x:563,y:69,width:752,height:872},14);
  await expectRect(page,".msg-context",{x:1315,y:69,width:357,height:872},14);
  await page.screenshot({path:"test-results/messages-personal-1672.png",fullPage:false});
  await page.getByRole("button",{name:"Поиск в чате"}).click();
  await expect(page.getByRole("searchbox",{name:"Поиск по сообщениям чата"})).toBeVisible();
  await page.getByRole("searchbox",{name:"Поиск по сообщениям чата"}).fill("Проверь");
  await page.getByRole("searchbox",{name:"Поиск по сообщениям чата"}).press("Escape");
  await expect(page.getByRole("searchbox",{name:"Поиск по сообщениям чата"})).toHaveCount(0);
});

test("mobile messages open real dialog and return to list",async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openMessages(page);
  await expect(page.getByRole("complementary",{name:"Список диалогов"})).toBeVisible();
  await expect(page.locator(".chat-thread")).toHaveCount(0);
  await page.getByRole("button",{name:/Маяки/}).first().click();
  await expect(page.locator(".chat-thread")).toBeVisible();
  await page.getByRole("button",{name:"К списку диалогов"}).click();
  await expect(page.getByRole("complementary",{name:"Список диалогов"})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test("pin, archive, restore and contact menu all perform real state transitions",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  await openMessages(page);
  const pin=page.getByRole("button",{name:"Закрепить диалог «Маяки»"});
  await pin.click();
  await expect(page.getByRole("button",{name:"Открепить диалог «Маяки»"})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Открепить диалог «Маяки»"}).click();
  await expect(pin).toHaveAttribute("aria-pressed","false");
  await page.getByRole("button",{name:"Перенести «Елена Наставник» в архив"}).click();
  await page.getByRole("tab",{name:"Архив"}).click();
  await expect(page.getByRole("button",{name:"Вернуть «Елена Наставник» из архива"})).toBeVisible();
  await page.getByRole("button",{name:"Вернуть «Елена Наставник» из архива"}).click();
  await page.getByRole("tab",{name:/Все/}).click();
  await expect(page.getByRole("button",{name:/Елена Наставник/}).first()).toBeVisible();
  const creator=page.getByRole("button",{name:"Создать чат"});
  await creator.click();
  await expect(page.getByRole("menu",{name:"Контакты для нового диалога"})).toBeVisible();
  await page.getByRole("menu",{name:"Контакты для нового диалога"}).press("Escape");
  await expect(page.getByRole("menu",{name:"Контакты для нового диалога"})).toHaveCount(0);
  await expect(creator).toBeFocused();
});

test("composer toolbar icons open genuine attachment, emoji and mention controls",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  await openMessages(page);
  await page.getByRole("button",{name:/Открыть последний чат/}).click();
  await page.getByRole("button",{name:"Вложения"}).click();
  await expect(page.getByTestId("composer-attachments")).toBeVisible();
  await page.getByRole("button",{name:"Эмодзи"}).click();
  await expect(page.getByRole("dialog",{name:"Эмодзи"})).toBeVisible();
  await page.getByRole("button",{name:"Вставить 🙏"}).click();
  await expect(page.getByTestId("composer-textarea")).toHaveValue("🙏");
  await page.getByRole("button",{name:"Упомянуть участника"}).click();
  await expect(page.getByRole("listbox",{name:"Упоминания"})).toBeVisible();
  await page.getByRole("option",{name:"@Елена Наставник"}).click();
  await expect(page.getByTestId("composer-textarea")).toHaveValue("🙏@Елена Наставник ");
  await expect(page.getByTestId("composer-send")).toBeEnabled();
});

test("create chat opens real contacts rather than an empty decorative modal",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  await openMessages(page);
  await page.getByRole("button",{name:"Создать новый чат"}).click();
  await expect(page.getByRole("tab",{name:"Контакты"})).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("button",{name:/Елена Наставник/}).first()).toBeVisible();
});
