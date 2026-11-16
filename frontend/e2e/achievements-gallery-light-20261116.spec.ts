import { expect, test, type Page } from "@playwright/test";
const actor={person_id:"00000000-0000-4000-8000-000000000001",display_name:"Синтетический участник",active_role:"participant",assigned_roles:["participant"],scopes:[],consent_scopes:[],navigation:["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения","AI-Buddy","Настройки"],csrf_token:"gallery-qa"};
const data={person_id:actor.person_id,demo_data:false,
  contributions:[{contribution_id:"qa-project",project_title:"Проверенный проект",personal_summary:"Подтверждённый вклад",artifact_keys:["report"],grade:"A",review_reason:"Проверено",verification_status:"verified"}],
  courses:[{key:"qa-course",title:"Курс тестирования",status:"verified"}],credentials:[],
  trophies:[{title:"Победа QA",organizer:"Организатор",source_url:"https://example.test/source",trophy_type:"winner"}]};
async function start(page:Page,mode:"light"|"blue"|"midnight"){
  await page.addInitScript((v:string)=>{localStorage.setItem("impulse-visual-mode",v);localStorage.setItem("impulse-theme",v==="light"?"light":"dark");},mode);
  await page.route("**/api/v1/config",r=>r.fulfill({json:{demo_mode:true}}));
  await page.route(/\/api\/v1\/me$/,r=>r.fulfill({json:actor}));
  await page.route("**/api/v1/me/portfolio",r=>r.fulfill({json:data}));
  await page.route("**/api/v1/me/event-claims",r=>r.fulfill({json:[]}));
  await page.goto("/workspace/8",{waitUntil:"domcontentloaded"});
  await expect(page.getByTestId("achievements-v2")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode",mode);
  await expect(page.getByTestId("achievement-card")).toHaveCount(3);
}
async function surface(page:Page,selector:string){return page.locator(selector).first().evaluate(e=>({bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e).color,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));}
function luminance(s:string){const m=s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);if(!m)throw Error(s);const [r,g,b]=m.slice(1,4).map(x=>{const n=Number(x)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return r*.2126+g*.7152+b*.0722;}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const mode of ["light","blue","midnight"] as const)for(const width of [320,390,1440]){
  test("Gallery material "+mode+" "+String(width)+"px",async({page})=>{
    await page.setViewportSize({width,height:850});await start(page,mode);
    for(const selector of [".ach-gallery-hero",".ach-gallery-stat",".ach-gallery-search",".ach-gallery-card"]){
      const x=await surface(page,selector);
      if(mode==="light")expect(luminance(x.bg),selector).toBeGreaterThan(.65);
      else expect(luminance(x.bg),selector).toBeLessThan(.14);
      expect(x.left).toBeGreaterThanOrEqual(-2);expect(x.right).toBeLessThanOrEqual(width+2);
    }
    if(mode==="light"){
      const x=await surface(page,".ach-gallery-card"),y=await surface(page,".ach-gallery-card h3");
      expect(contrast(x.bg,y.fg),"Card title must meet WCAG AA").toBeGreaterThanOrEqual(4.5);
      const art=await surface(page,".ach-gallery-card--project .ach-gallery-art");
      expect(luminance(art.bg),"Art canvas must be pale, not navy").toBeGreaterThan(.65);
    }
    await page.getByRole("button",{name:"Подробнее: Проверенный проект"}).click();
    const drawer=page.getByRole("dialog",{name:"Подробности достижения"});await expect(drawer).toBeVisible();
    const d=await surface(page,".ach-gallery-drawer");
    if(mode==="light"){
      expect(d.bg).toBe("rgb(255, 255, 255)");
      const art=await surface(page,".ach-gallery-drawer-art");
      expect(luminance(art.bg),"Detail art canvas must be pale").toBeGreaterThan(.65);
    }
    else expect(luminance(d.bg)).toBeLessThan(.14);
    await drawer.getByRole("tab",{name:"Материалы"}).click();
    await expect(drawer.getByRole("tabpanel")).toBeVisible();
    await drawer.getByRole("button",{name:"Закрыть подробности"}).click();
    await page.getByRole("button",{name:"Добавить достижение"}).first().click();
    const dialog=page.getByRole("dialog",{name:"Добавить достижение"});await expect(dialog).toBeVisible();
    const add=await surface(page,".ach-gallery-add");
    if(mode==="light")expect(add.bg).toBe("rgb(255, 255, 255)");
    else expect(luminance(add.bg)).toBeLessThan(.14);
    await dialog.getByRole("button",{name:"Закрыть"}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });
}
