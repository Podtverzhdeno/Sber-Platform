import { expect, test, type Page } from "@playwright/test";

type Mode="light"|"blue"|"midnight";
const actor={person_id:"00000000-0000-4000-8000-000000000001",display_name:"Проверочный участник",
 active_role:"participant",assigned_roles:["participant"],scopes:[],consent_scopes:[],
 navigation:["Главная","AI-Buddy","Настройки"],csrf_token:"buddy-color-qa"};
const profile={person_id:actor.person_id,display_name:actor.display_name,city:"",university:"",study_year:"",
 primary_track:"python",email:"",telegram:"",about:"",avatar_url:"",locale:"ru-RU",
 theme:"light",timezone:"Europe/Moscow",buddy_enabled:true,skills:[]};
async function openBuddy(page:Page,mode:Mode){
 await page.addInitScript((v:string)=>{
  localStorage.setItem("impulse-visual-mode",v);
  localStorage.setItem("impulse-theme",v==="light"?"light":"dark");
 },mode);
 await page.route("**/api/v1/**",route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==="/api/v1/config")return route.fulfill({json:{demo_mode:true}});
  if(path==="/api/v1/me")return route.fulfill({json:actor});
  if(path==="/api/v1/me/profile")return route.fulfill({json:profile});
  if(path==="/api/v1/development/courses")return route.fulfill({json:[]});
  if(path==="/api/v1/me/journey/snapshot")return route.fulfill({json:{person_id:actor.person_id,self_study_available:true,courses:[],projects:[],accepted_case_count:0,verified_provider_course_count:0}});
  if(path==="/api/v1/me/talent-passport")return route.fulfill({json:{person_id:actor.person_id,skills:[]}});
  if(path==="/api/v1/me/analytics/journey")return route.fulfill({json:{next_action:"",freshness:"unknown"}});
  if(path==="/api/v1/me/rating/standings"||path==="/api/v1/rating-seasons")return route.fulfill({json:[]});
  if(path==="/api/v1/agents/buddy/suggestion")return route.fulfill({json:{suggestion:null}});
  return route.fulfill({status:503,json:{code:"UNAVAILABLE"}});
 });
 await page.goto("/workspace/1",{waitUntil:"domcontentloaded"});
 await expect(page.getByTestId("buddy-chat-v2")).toBeVisible();
 await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode",mode);
 await expect(page.getByRole("heading",{name:/Привет, я AI-Buddy!/})).toBeVisible();
}
async function colors(page:Page,selector:string){return page.locator(selector).first().evaluate(node=>{
 const v=getComputedStyle(node),r=node.getBoundingClientRect();
 return {bg:v.backgroundColor,fg:v.color,left:r.left,right:r.right};
});}
function lum(s:string){const m=s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);if(!m)throw Error(s);
 const channels=m.slice(1,4).map(x=>{const v=Number(x)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
function contrast(a:string,b:string){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const mode of ["light","blue","midnight"] as const)for(const width of [320,390,1440]){
 test("Buddy readable materials "+mode+" "+String(width)+"px",async({page})=>{
  await page.setViewportSize({width,height:850});await openBuddy(page,mode);
  const surfaceSelectors=[".buddy2-sidebar",".buddy2-main",".buddy2-hero",".buddy2-new",".buddy2-bubble",".buddy2-composer"];
  for(const selector of surfaceSelectors){
   const s=await colors(page,selector);
   if(mode==="light")expect(lum(s.bg),selector).toBeGreaterThan(.73);
   else if(selector!==".buddy2-hero")expect(lum(s.bg),selector).toBeLessThan(.25);
   expect(s.left,selector+" left").toBeGreaterThanOrEqual(-2);
   expect(s.right,selector+" right").toBeLessThanOrEqual(width+2);
  }
  if(mode==="light"){
   for(const [fg,bg] of [
    [".buddy2-sidehead h2",".buddy2-sidebar"],
    [".buddy2-hero h1",".buddy2-hero"],
    [".buddy2-hero p",".buddy2-hero"],
    [".buddy2-bubble strong",".buddy2-bubble"],
    [".buddy2-composer input",".buddy2-composer"],
   ]){
    const a=await colors(page,fg),b=await colors(page,bg);
    expect(contrast(a.fg,b.bg),fg+" WCAG AA").toBeGreaterThanOrEqual(4.5);
   }
  }
  await expect(page.getByRole("button",{name:"Новый диалог"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Отправить сообщение"})).toBeVisible();
  await page.getByRole("button",{name:"Закрыть баннер AI-Buddy"}).click();
  await expect(page.locator(".buddy2-hero")).toHaveCount(0);
  await expect(page.locator(".buddy2-composer")).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow,"no horizontal document scrolling").toBeLessThanOrEqual(2);
 });
}
