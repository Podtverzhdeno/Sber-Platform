import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id:"00000000-0000-4000-8000-000000000001",
  display_name:"Синтетический участник",
  active_role:"participant",
  assigned_roles:["participant"],scopes:[],consent_scopes:[],
  navigation:["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения","AI-Buddy","Настройки"],
  csrf_token:"rating-contrast-qa",
};
const season={id:"season-qa",key:"spring-2026",title:"Проверенный сезон",status:"open",version:1,policy_version:1};
const people=[
  {place:1,person_id:"person-first",display_name:"Ирина Тестовая",score:"150",successful_projects:4,trophies:[],offers:[],anonymized:false},
  {place:2,person_id:"person-second",display_name:"Сергей Проверочный",score:"120",successful_projects:3,trophies:[],offers:[],anonymized:false},
  {place:3,person_id:"person-third",display_name:"Анна Контрольная",score:"95",successful_projects:2,trophies:[],offers:[],anonymized:false},
];
type Mode="light"|"blue"|"midnight";
async function setup(page:Page,mode:Mode){
  await page.addInitScript((value:string)=>{
    localStorage.setItem("impulse-visual-mode",value);
    localStorage.setItem("impulse-theme",value==="light"?"light":"dark");
  },mode);
  await page.route("**/api/v1/config",route=>route.fulfill({json:{demo_mode:true}}));
  await page.route(/\/api\/v1\/me$/,route=>route.fulfill({json:actor}));
  await page.route("**/api/v1/rating-seasons",route=>route.fulfill({json:[season]}));
  await page.route("**/api/v1/rating-seasons/season-qa/leaderboard",route=>route.fulfill({json:people}));
  await page.route("**/api/v1/me/rating/standings",route=>route.fulfill({json:[]}));
  await page.goto("/workspace/6",{waitUntil:"domcontentloaded"});
  await expect(page.getByTestId("rating-v2")).toBeVisible();
  await expect(page.getByTestId("rating-v2")).toHaveAttribute("data-screen","list");
  await expect(page.getByRole("heading",{name:"Все участники рейтинга"})).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode",mode);
}
const surface=async(page:Page,selector:string)=>page.locator(selector).first().evaluate(el=>({
  bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color,
  rect:{left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right},
}));
const brightness=(value:string)=>{
  const m=value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if(!m)throw Error("Unrecognized rgb: "+value);
  return (0.2126*Number(m[1])+0.7152*Number(m[2])+0.0722*Number(m[3]))/255;
};
const rgbLum=(color:string)=>{
  const m=color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if(!m)throw Error("Unrecognized foreground: "+color);
  const l=[Number(m[1]),Number(m[2]),Number(m[3])].map(n=>{
    const v=n/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
  });
  return 0.2126*l[0]+0.7152*l[1]+0.0722*l[2];
};
const contrast=(a:string,b:string)=>{
  const x=rgbLum(a),y=rgbLum(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};

for(const mode of ["light","blue","midnight"] as const){
  for(const width of [320,390,1440]){
    test("Rating reference surfaces "+mode+" "+String(width)+"px",async({page})=>{
      await page.setViewportSize({width,height:900});
      await setup(page,mode);
      const root=page.getByTestId("rating-v2");
      await expect(root.locator(".ir-leader-row")).toHaveCount(3);
      const row=await surface(page,".ir-leader-row--1");
      const name=await surface(page,".ir-leader-row--1 .ir-person button");
      const search=await surface(page,".ir-control--search");
      const filter=await surface(page,".ir-ranking-filters");
      if(mode==="light"){
        for(const [selector,x] of Object.entries({row,search,filter})){
          expect(brightness(x.bg),selector+" must not be dark").toBeGreaterThan(.78);
        }
        expect(contrast(name.fg,row.bg),"ranking name WCAG AA").toBeGreaterThanOrEqual(4.5);
        expect(name.fg).not.toBe("rgb(244, 250, 255)");
      }else{
        expect(brightness(row.bg)).toBeLessThan(.3);
        expect(brightness(search.bg)).toBeLessThan(.3);
      }
      const firstReward=root.getByRole("button",{name:/Подробнее: ТОП 30/});
      await firstReward.click();
      const detail=page.getByRole("dialog",{name:/ТОП 30/});
      await expect(detail).toBeVisible();
      const modal=await surface(page,".ir-modal");
      const body=await surface(page,".ir-modal-list li");
      if(mode==="light"){
        expect(brightness(modal.bg)).toBeGreaterThan(.9);
        expect(contrast(body.fg,modal.bg)).toBeGreaterThanOrEqual(4.5);
      }else{
        expect(brightness(modal.bg)).toBeLessThan(.3);
      }
      await detail.getByRole("button",{name:"Закрыть описание награды"}).click();
      await expect(detail).toHaveCount(0);
      await root.getByRole("button",{name:/Подробнее о рейтинге и наградах/}).click();
      await expect(root).toHaveAttribute("data-screen","benefits");
      await expect(root.locator(".ir-top-card")).toHaveCount(3);
      const top=await surface(page,".ir-top-card--gold");
      const why=await surface(page,".ir-why article");
      if(mode==="light"){
        expect(brightness(top.bg)).toBeGreaterThan(.8);
        expect(brightness(why.bg)).toBeGreaterThan(.8);
      }else expect(brightness(top.bg)).toBeLessThan(.3);
      await root.getByRole("button",{name:/Смотреть весь список/}).click();
      await expect(root).toHaveAttribute("data-screen","list");
      await root.locator(".ir-leader-row").first().getByRole("button",{name:"Профиль",exact:false}).last().click();
      await expect(root).toHaveAttribute("data-screen","profile");
      const profile=await surface(page,".ir-profile-hero");
      const panel=await surface(page,".ir-profile-panel");
      const unlock=await surface(page,".ir-unlock");
      if(mode==="light"){
        for(const x of [profile,panel,unlock])expect(brightness(x.bg)).toBeGreaterThan(.8);
      }else expect(brightness(profile.bg)).toBeLessThan(.3);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow,"document horizontal overflow").toBeLessThanOrEqual(2);
    });
  }
}
