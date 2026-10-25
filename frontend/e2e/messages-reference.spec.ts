import { expect, test, type Page } from "@playwright/test";
import { referenceChannels, referenceMessagesByChannel } from "./messages-reference-fixtures";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Задачи", "Проекты", "Курсы", "Сообщения", "Команда", "База знаний", "Аналитика", "Настройки"],
  csrf_token: "messages-reference",
};
const makeMessage = (id: string, body: string, author_name = "Елена Наставник") => ({
  id, author_id: "00000000-0000-4000-8000-000000000005", author_name,
  kind: "text", body, artifact_refs: [], sequence: 1,
  created_at: "2026-10-20T09:14:00Z",
});
async function openMessages(page: Page, opts: { unreadContact?: boolean; eventCommunity?: boolean; linkedNotification?: boolean } = {}) {
  let loggedIn = false;
  const channels: Array<Omit<(typeof referenceChannels)[number], "last_message"> & { last_message: (typeof referenceChannels)[number]["last_message"] | null }> =
    referenceChannels.map((channel) => ({
      ...channel,
      unread: opts.unreadContact && channel.title === "Елена Наставник" ? 3 : channel.unread,
    }));
  if (opts.eventCommunity) channels.push({
    ...channels[1], id: "00000000-0000-4000-8000-000000004444",
    title: "События", unread: 2,
  });
  const sentMessages: string[] = [];
  const readRequests: string[] = [];
  const mutedRequests: Array<{channelId:string;muted:boolean}> = [];
  const linkedNotificationReads: string[] = [];
  const feed = opts.linkedNotification ? [{
    id:"00000000-0000-4000-8000-000000006666",kind:"message",read:false,
    title:"Новое сообщение от ментора",body:"Проверьте диалог",
    entity_type:"messaging_channel",entity_id:"00000000-0000-4000-8000-000000000102",
    created_at:"2026-10-20T10:00:00Z",
  }] : [];
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
  await page.route("**/api/v1/me/notifications", route =>
    route.fulfill({json:{items:feed,unread:feed.filter(item=>!item.read).length}}));
  await page.route("**/api/v1/me/notifications/*/read", route => {
    const id=new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    linkedNotificationReads.push(id);
    const entry=feed.find(item=>item.id===id);
    if (!entry) return route.fulfill({status:404,json:{}});
    entry.read=true;
    return route.fulfill({json:entry});
  });
  await page.route("**/api/v1/me/messaging/contacts", route => route.fulfill({json:[
    {id:"00000000-0000-4000-8000-000000000005",display_name:"Елена Наставник",role:"mentor"},
    {id:"00000000-0000-4000-8000-000000000006",display_name:"Роман Заказчик",role:"customer"},
    {id:"00000000-0000-4000-8000-000000000007",display_name:"Мария Северова",role:"participant"},
  ]}));
  await page.route("**/api/v1/me/messaging/channels/group", route => {
    const posted=route.request().postDataJSON() as {title:string;peer_ids:string[]};
    const group={
      ...channels[0],id:"00000000-0000-4000-8000-000000009999",kind:"community",
      title:posted.title,unread:0,last_message:null,
      participants:[
        {id:actor.person_id,display_name:actor.display_name,role:"member"},
        ...posted.peer_ids.map(id=>({id,display_name:id.endsWith("005")?"Елена Наставник":"Роман Заказчик",role:"member"})),
      ],
    };
    channels.push(group);
    return route.fulfill({status:201,json:group});
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
    const fixture=referenceMessagesByChannel[String(id)];
    return route.fulfill({json:fixture ?? [makeMessage("msg-"+String(id),"Задача в работе")]});
  });
  await page.route("**/api/v1/me/messaging/channels/*/mute", route => {
    const channelId = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    const body = route.request().postDataJSON() as { muted: boolean };
    mutedRequests.push({ channelId, muted: body.muted });
    const channel = channels.find(item => item.id === channelId);
    if (!channel) return route.fulfill({status:404,json:{code:"RESOURCE_NOT_FOUND"}});
    channel.muted = body.muted;
    return route.fulfill({json:channel});
  });
  await page.route("**/api/v1/me/messaging/channels/*/read", route => {
    const channelId=new URL(route.request().url()).pathname.split("/").at(-2);
    if(channelId) readRequests.push(channelId);
    const channel=channels.find(item=>item.id===channelId) ?? channels[0];
    channel.unread=0;
    return route.fulfill({json:channel});
  });
  await page.clock.install({ time: new Date("2026-10-20T14:00:00+03:00") });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/4");
  await expect(page.getByRole("complementary",{name:"Список диалогов"})).toBeVisible();
  return {sentMessages,readRequests,mutedRequests,linkedNotificationReads,channels};
}

async function expectRect(page:Page, selector:string, expected:{x:number,y:number,width:number,height:number}, tolerance=8) {
  const actual = await page.locator(selector).boundingBox();
  expect(actual, selector+" must be visible").not.toBeNull();
  for(const key of ["x","y","width","height"] as const) {
    expect(actual?.[key],selector+" "+key).toBeGreaterThanOrEqual(expected[key]-tolerance);
    expect(actual?.[key],selector+" "+key).toBeLessThanOrEqual(expected[key]+tolerance);
  }
}

test("notification identifies the exact sender and marks only that dialog read on click",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  const {readRequests,channels}=await openMessages(page,{unreadContact:true});
  await page.getByRole("button",{name:/Уведомления:/}).click();
  const named=page.locator(".notification-chat-unread").filter({hasText:"Елена Наставник"});
  await expect(named).toBeVisible();
  await expect(named).toContainText("непрочитанных");
  await named.click();
  await expect(page.locator(".msg-chat__header-title")).toContainText("Елена Наставник");
  await expect.poll(()=>readRequests.length).toBeGreaterThan(0);
  const direct=channels.find(item=>item.title==="Елена Наставник");
  expect(readRequests.every(id=>id===direct?.id)).toBe(true);
  await expect.poll(()=>direct?.unread).toBe(0);
  await expect(page.locator(".notification-chat-unread").filter({hasText:"Елена Наставник"})).toHaveCount(0);
});

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
  await expectRect(page,".msg-dialog-list",{x:244,y:64,width:367,height:1022},12);
  await expectRect(page,".chat-thread",{x:611,y:64,width:495,height:1022},14);
  await expectRect(page,".msg-reference-context-empty",{x:1106,y:64,width:298,height:1022},14);
  await expect(page.locator(".msg-reference-empty__exact-art")).toHaveAttribute("src","/messages-reference/empty-hero-original.svg");
  await page.mouse.move(5,5);
  await page.screenshot({path:"test-results/messages-empty-1448.png",fullPage:false});
});

test("quick actions, search, tabs, context, mute, chat input operate end to end",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  const {sentMessages}=await openMessages(page);
  await page.getByRole("button",{name:/Перейти в Маяки/}).click();
  await expect(page.locator(".msg-chat__header-title")).toContainText("Маяки");
  await expect(page.locator(".msg-chat__avatar img")).toHaveAttribute("src","/messages-reference/mayaki-avatar.svg");
  await expect(page.locator(".messenger-page")).toHaveAttribute("data-message-state","community");
  await expectRect(page,".msg-dialog-list",{x:244,y:64,width:334,height:1022},12);
  await expectRect(page,".chat-thread",{x:578,y:64,width:518,height:1022},14);
  await expectRect(page,".msg-context",{x:1096,y:64,width:352,height:1022},14);
  await page.locator(".msg-chat__scroll").evaluate(element => {element.scrollTop=0;});
  await page.mouse.move(5,5);
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
  await page.getByRole("complementary",{name:"Контекст диалога"}).getByRole("button",{name:"Отключить уведомления"}).click();
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
  await expectRect(page,".msg-dialog-list",{x:244,y:64,width:391,height:877},12);
  await expectRect(page,".chat-thread",{x:635,y:64,width:680,height:877},14);
  await expectRect(page,".msg-context",{x:1315,y:64,width:357,height:877},14);
  await page.locator(".msg-chat__scroll").evaluate(element => {element.scrollTop=0;});
  await page.mouse.move(5,5);
  await page.screenshot({path:"test-results/messages-personal-1672.png",fullPage:false});
  await page.getByRole("button",{name:"Поиск в чате"}).click();
  await expect(page.getByRole("searchbox",{name:"Поиск по сообщениям чата"})).toBeVisible();
  await page.getByRole("searchbox",{name:"Поиск по сообщениям чата"}).fill("Проверь");
  await page.getByRole("searchbox",{name:"Поиск по сообщениям чата"}).press("Escape");
  await expect(page.getByRole("searchbox",{name:"Поиск по сообщениям чата"})).toHaveCount(0);
});

test("Messages shares the exact navigation shell with Analytics and preserves the active chat", async ({page}) => {
  await page.setViewportSize({width:1448,height:1086});
  await openMessages(page);
  const sidebar=page.getByRole("complementary",{name:"Боковая панель"});
  const signature=async () => sidebar.evaluate(el=>({
    brand:el.querySelector(".sidebar-brand")?.innerHTML,
    icons:Array.from(el.querySelectorAll("nav .nav-icon"),icon=>icon.innerHTML),
    promo:el.querySelector(".sidebar-message")?.innerHTML,
  }));
  const expected=await signature();
  await expectRect(page,".sidebar",{x:0,y:0,width:244,height:1086},2);
  await expect(sidebar.locator(".sidebar-message")).toContainText("Развиваем технологии вместе");
  await expect(page.getByRole("button",{name:"Свернуть навигацию"})).toHaveCount(0);

  await page.getByRole("link",{name:"Аналитика",exact:true}).click();
  await expect(page.getByRole("link",{name:"Аналитика",exact:true})).toHaveAttribute("aria-current","page");
  expect(await signature()).toEqual(expected);
  await expectRect(page,".sidebar",{x:0,y:0,width:244,height:1086},2);

  await page.getByRole("link",{name:"Сообщения",exact:true}).click();
  await expect(page.getByRole("complementary",{name:"Список диалогов"})).toBeVisible();
  expect(await signature()).toEqual(expected);
  await page.getByRole("button",{name:/Перейти в Маяки/}).click();
  await expect(page.locator(".msg-chat__header-title")).toContainText("Маяки");
  expect(await signature()).toEqual(expected);
});

test("group creation selects real contacts and persists a chat in API list",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  await openMessages(page);
  await page.getByRole("button",{name:"Создать чат"}).click();
  await page.getByRole("menuitem",{name:/Новый групповой чат/}).click();
  const dialog=page.getByRole("dialog",{name:"Создать групповой чат"});
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Например, Команда AI-проекта").fill("AI исследование");
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog.getByRole("button",{name:"Создать чат"}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".msg-chat__header-title")).toContainText("AI исследование");
  await page.getByRole("tab",{name:/Все/}).click();
  await expect(page.getByRole("button",{name:/AI исследование/}).first()).toBeVisible();
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
  await page.locator(".msg-composer").getByRole("button",{name:"Вложения"}).click();
  await expect(page.getByTestId("composer-attachments")).toBeVisible();
  const panel=await page.getByTestId("composer-attachments").boundingBox();
  const input=await page.getByTestId("composer-ref-input").boundingBox();
  const add=await page.getByTestId("composer-attachments").getByRole("button",{name:"Добавить"}).boundingBox();
  expect(panel && input && add).toBeTruthy();
  if(panel && input && add) {
    expect(input.x).toBeGreaterThanOrEqual(panel.x);
    expect(input.x+input.width).toBeLessThanOrEqual(add.x+2);
    expect(add.x+add.width).toBeLessThanOrEqual(panel.x+panel.width+2);
  }
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

test("creates a real persisted group from selected contacts, not a UI-only card", async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  const {channels}=await openMessages(page);
  let submitted: {title:string;peer_ids:string[]} | null=null;
  await page.route("**/api/v1/me/messaging/channels/group", async route => {
    submitted=route.request().postDataJSON() as {title:string;peer_ids:string[]};
    const group={
      ...channels[0],id:"00000000-0000-4000-8000-000000009999",
      kind:"community",title:submitted.title,unread:0,last_message:null,
      participants:[
        {id:actor.person_id,display_name:actor.display_name,role:"member"},
        ...submitted.peer_ids.map(id=>({
          id,display_name:id.endsWith("005")?"Елена Наставник":"Роман Заказчик",role:"member",
        })),
      ],
    };
    channels.push(group);
    await route.fulfill({status:201,json:group});
  });
  await page.getByRole("button",{name:"Создать чат",exact:true}).click();
  await page.getByRole("menuitem",{name:/Новый групповой чат/}).click();
  const dialog=page.getByRole("dialog",{name:"Создать групповой чат"});
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox",{name:"Название группы"}).fill("Обсуждение проекта");
  await dialog.getByRole("checkbox",{name:/Елена Наставник/}).check();
  await dialog.getByRole("checkbox",{name:/Роман Заказчик/}).check();
  await dialog.getByRole("button",{name:"Создать чат"}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".msg-chat__header-title")).toContainText("Обсуждение проекта");
  // A new group opens immediately; the current sidebar filter may not list communities.
  // Assert the selected channel and the persisted API fixture instead of sidebar visibility.
  await expect(page.locator(".msg-chat__header-title")).toContainText("Обсуждение проекта");
  expect(submitted).toEqual({
    title:"Обсуждение проекта",
    peer_ids:[
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ],
  });
  expect(channels.some(channel=>channel.title==="Обсуждение проекта")).toBe(true);
});

test("create chat opens real contacts rather than an empty decorative modal",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  await openMessages(page);
  await page.getByRole("button",{name:"Создать новый чат"}).click();
  await expect(page.getByRole("tab",{name:"Контакты"})).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("button",{name:/Елена Наставник/}).first()).toBeVisible();
});

test("chat details collapse into full width for direct, community and Events conversations", async ({page}) => {
  await page.setViewportSize({width:1672,height:941});
  const {channels} = await openMessages(page,{eventCommunity:true});
  for (const name of ["Елена Наставник", "Маяки", "События"]) {
    const record = channels.find(channel=>channel.title===name);
    expect(record, name).toBeDefined();
    await page.getByRole("button",{name:new RegExp(name)}).first().click();
    const shell = page.locator(".messenger-shell");
    await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toBeVisible();
    const before = await page.locator(".chat-thread").boundingBox();
    await page.getByRole("button",{name:"К чату"}).click();
    await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toHaveCount(0);
    await expect(shell).toHaveClass(/messenger-shell--no-context/);
    await expect.poll(async ()=> (await page.locator(".chat-thread").boundingBox())?.width ?? 0)
      .toBeGreaterThan((before?.width ?? 0)+220);
    const after = await page.locator(".chat-thread").boundingBox();
    const container = await shell.boundingBox();
    expect(after?.x).toBeDefined();
    if(after && container){
      expect(Math.abs(after.x+after.width-(container.x+container.width))).toBeLessThanOrEqual(2);
    }
    await page.getByRole("button",{name:new RegExp("Профиль чата «"+name+"»")}).click();
    await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toBeVisible();
    await page.getByRole("button",{name:"Показать участников чата",exact:false}).click();
    await expect(page.getByRole("complementary",{name:"Контекст диалога"})).toHaveCount(0);
  }
});

test("reading a chat instantly clears only its badge and notification; mute icon actually toggles", async ({page}) => {
  await page.setViewportSize({width:1448,height:1086});
  const {channels,readRequests,mutedRequests} = await openMessages(page,{unreadContact:true});
  const mentor = channels.find(channel=>channel.title==="Елена Наставник");
  const mayaki = channels.find(channel=>channel.title==="Маяки");
  expect(mentor).toBeDefined();
  expect(mayaki).toBeDefined();
  await page.getByRole("button",{name:/Уведомления:/}).click();
  await expect(page.locator(".notification-chat-unread").filter({hasText:"Елена Наставник"})).toBeVisible();
  await page.getByRole("button",{name:/Уведомления:/}).click();
  await page.getByRole("button",{name:/Елена Наставник/}).first().click();
  await expect.poll(()=>readRequests.includes(mentor?.id ?? "")).toBe(true);
  await expect.poll(()=>mentor?.unread).toBe(0);
  await page.getByRole("button",{name:/Уведомления:/}).click();
  await expect(page.locator(".notification-chat-unread").filter({hasText:"Елена Наставник"})).toHaveCount(0);
  await expect(page.locator(".notification-chat-unread").filter({hasText:"Маяки"})).toBeVisible();
  await page.getByRole("button",{name:/Уведомления:/}).click();
  const mute = page.getByRole("button",{name:"Отключить уведомления"}).first();
  await expect(mute.locator("svg")).toBeVisible();
  await mute.click();
  await expect.poll(()=>mutedRequests.some(item=>item.channelId===mentor?.id && item.muted)).toBe(true);
  await expect(page.getByRole("button",{name:"Включить уведомления"}).first()).toBeVisible();
  await page.getByRole("button",{name:"Включить уведомления"}).first().click();
  await expect.poll(()=>mutedRequests.some(item=>item.channelId===mentor?.id && !item.muted)).toBe(true);
  await expect(page.getByRole("button",{name:"Отключить уведомления"}).first()).toBeVisible();
});

test("linked generic notifications are deduplicated and marked read with the exact chat",async ({page})=>{
  await page.setViewportSize({width:1448,height:1086});
  const {channels,readRequests,linkedNotificationReads}=await openMessages(page,{unreadContact:true,linkedNotification:true});
  const mentor=channels.find(channel=>channel.title==="Елена Наставник");
  await page.getByRole("button",{name:/Уведомления:/}).click();
  await expect(page.locator(".notification-chat-unread").filter({hasText:"Елена Наставник"})).toHaveCount(1);
  // The same chat alert is never duplicated as a generic notification.
  await expect(page.getByRole("dialog",{name:"Центр уведомлений"}).getByRole("button",{name:/Новое сообщение от ментора/})).toHaveCount(0);
  await page.getByRole("button",{name:/Уведомления:/}).click();
  await page.getByRole("button",{name:/Елена Наставник/}).first().click();
  await expect.poll(()=>readRequests.includes(mentor?.id ?? "")).toBe(true);
  await expect.poll(()=>linkedNotificationReads).toContain("00000000-0000-4000-8000-000000006666");
  await page.getByRole("button",{name:/Уведомления:/}).click();
  await expect(page.locator(".notification-chat-unread").filter({hasText:"Елена Наставник"})).toHaveCount(0);
});
