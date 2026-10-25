import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

async function productTrajectoryFixture(page:import("@playwright/test").Page){
  await page.route("**/api/v1/participant/me/development-overview",route=>route.fulfill({json:{
    ...overviewFixture,
    roles:[...overviewFixture.roles,{track_key:"product",title:"AI Architect",state:"active",attempt_number:1,completed_milestones:0,total_milestones:2}],
  }}));
}


test("finishing a saved required Impulse course refreshes the role's learning stage and removes stale demand", async ({ page }) => {
  await installBootcampReferenceApi(page);
  await productTrajectoryFixture(page);
  await page.setViewportSize({ width:1448, height:950 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();

  const bootcamp=page.locator(".bc-reference");
  await expect(bootcamp).toBeVisible();
  await expect(bootcamp.getByRole("heading",{name:/Остался.*1.*обязательный.*курс/})).toBeVisible();
  await expect(bootcamp.getByTestId("bootcamp-study-level")).toContainText("0 из 4");
  await expect(bootcamp.getByTestId("bootcamp-official-grade")).toContainText("данные недоступны");

  // Complete all eight units through the same authenticated API as the course
  // player. Fixture persistence is authoritative; UI can't set a completion.
  await page.evaluate(async () => {
    const csrf=sessionStorage.getItem("impulse_csrf")??"";
    const url="/api/v1/me/bootcamp/impulse-study/demo-course-1";
    for(let i=0;i<8;i++){
      const response=await fetch(url+"/lessons/"+String(i)+"/complete",{
        method:"POST",headers:{"X-CSRF-Token":csrf},
      });
      if(!response.ok)throw new Error("Lesson "+String(i)+" rejected: "+String(response.status));
    }
    const finish=await fetch(url+"/finish",{method:"POST",headers:{"X-CSRF-Token":csrf}});
    if(!finish.ok)throw new Error("Finish rejected: "+String(finish.status));
  });
  await page.reload();
  const refreshed=page.locator(".bc-reference");
  await expect(refreshed.getByRole("heading",{name:"Учебная часть завершена"})).toBeVisible();
  await expect(refreshed.getByTestId("bootcamp-next-stage")).toContainText("практика");
  await expect(refreshed.getByTestId("bootcamp-study-level")).toContainText("1 из 4");
  await expect(refreshed.getByTestId("bootcamp-official-grade")).toContainText("данные недоступны");
  const nextStageButton=refreshed.getByRole("button",{name:/Следующий этап/});
  await expect(nextStageButton).toHaveClass(/bc-ref-grade-button--unlock/);
  await nextStageButton.click();
  const celebration=page.getByTestId("grade-milestone-celebration");
  await expect(celebration).toHaveAttribute("data-mode","stage-unlocked");
  await expect(celebration).toContainText("НОВЫЙ ЭТАП");
  await page.screenshot({path:"test-results/bootcamp-new-stage-animation.png",animations:"disabled"});
  await expect(celebration).not.toContainText("ГРЕЙД ПОВЫШЕН");
  await celebration.getByRole("button",{name:"Начать следующий этап"}).click();
  await expect(celebration).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspace\/1\?role=product/);
  await expect(page.locator(".trajectory-v2")).toBeVisible();
  await expect(page.getByTestId("trajectory-role-detail")).toHaveAttribute("data-role-key","product");
  await page.screenshot({path:"test-results/bootcamp-role-after-course.png",animations:"disabled"});
});

test("an official grade is displayed exclusively from the server's verified projection",async({page})=>{
  await installBootcampReferenceApi(page);
  await page.route("**/api/v1/me/bootcamp/overview?track=product",route=>route.fulfill({json:{
    selected_track_key:"product",curriculum:{state:"not_evaluable"},
    role_summary:{track_key:"product",grade_state:"known",current_grade_title:"Опубликованный уровень L2"}
  }}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();
  await expect(page.getByTestId("bootcamp-official-grade")).toHaveText(/Опубликованный уровень L2/);
});

test("finishing from the real course player updates the requirement banner without reloading",async({page})=>{
  await installBootcampReferenceApi(page);
  await page.setViewportSize({width:1448,height:950});
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();
  await expect(page.locator("#bc-grade-title")).toContainText("Остался");
  const bootcampPath=new URL(page.url()).pathname;
  await page.goto(bootcampPath+"?course=demo-course-1");
  const reader=page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  await reader.getByRole("button",{name:/Перейти к программе/}).click();
  await reader.locator(".imp-study__program-list button").first().click();
  for(let i=0;i<8;i++){
    await reader.locator(".imp-study__navigation .imp-study__primary").click();
  }
  await expect(reader.getByRole("heading",{name:"Завершение обучения"})).toBeVisible();
  await reader.locator(".imp-study__finish").click();
  await expect(reader.getByRole("heading",{name:"Обучение завершено!"})).toBeVisible();
  const coursePopup=page.getByTestId("grade-milestone-celebration");
  await expect(coursePopup).toHaveAttribute("data-mode","course-complete");
  await coursePopup.getByRole("button",{name:"Вернуться к курсу"}).click();
  await expect(coursePopup).toHaveCount(0);
  // React Query invalidation must update the underlying role summary even
  // while the completed course's drawer stays open.
  await expect(page.locator("#bc-grade-title")).toContainText("Учебная часть завершена");
  await expect(page.getByTestId("bootcamp-study-level")).toContainText("1 из 4");
  await expect(page.getByTestId("bootcamp-next-stage")).toContainText("практика");
  await expect(page.getByTestId("bootcamp-official-grade")).toContainText("данные недоступны");
});

test("official grade promotion animation requires an actual change in the server projection",async({page})=>{
  await installBootcampReferenceApi(page);
  await productTrajectoryFixture(page);
  let currentGrade="L1";
  await page.route("**/api/v1/me/bootcamp/overview?track=product",route=>route.fulfill({json:{
    selected_track_key:"product",
    curriculum:currentGrade==="L2" ? {
      state:"known",policy_version:"approved-L2",requirements:[
        {key:"new-learning",title:"Новый курс: Security architecture",kind:"course",
         state:"open",source_key:"demo-course-10",source_version:"v2",allowed_action:"open_course"}
      ]
    }:{state:"not_evaluable"},
    role_summary:{track_key:"product",grade_state:"known",
      current_grade_key:currentGrade,current_grade_title:currentGrade, target_grade_key:"L3"}
  }}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();
  await expect(page.getByTestId("bootcamp-official-grade")).toContainText("L1");
  await expect(page.getByTestId("grade-milestone-celebration")).toHaveCount(0);
  const course=page.getByTestId("course-demo-course-1");
  await course.getByRole("button",{name:/Открыть курс/}).click();
  const reader=page.getByTestId("impulse-immersive-reader");
  await reader.getByRole("button",{name:/Перейти к программе/}).click();
  await reader.locator(".imp-study__program-list button").first().click();
  for(let i=0;i<8;i++){
    await reader.locator(".imp-study__navigation .imp-study__primary").click();
  }
  // Simulate a separately authorized server transition at the verification
  // boundary, not during earlier lesson events.
  await page.route("**/api/v1/me/bootcamp/impulse-study/demo-course-1/finish",async route=>{
    currentGrade="L2";
    await route.fallback();
  });
  await reader.locator(".imp-study__finish").click();
  const coursePopup=page.getByTestId("grade-milestone-celebration");
  await expect(coursePopup).toHaveAttribute("data-mode","course-complete");
  // Server grade promotion can arrive at the same time: queue it, never stack dialogs.
  await expect(page.locator('[data-mode="official-grade-up"]')).toHaveCount(0);
  await expect(page.getByTestId("bootcamp-official-grade")).toContainText("L2");
  await coursePopup.getByRole("button",{name:"Вернуться к курсу"}).click();
  const animation=page.getByTestId("grade-milestone-celebration");
  await expect(animation).toHaveAttribute("data-mode","official-grade-up");
  await expect(page.locator("#bc-grade-title")).toContainText("Остался");
  await expect(page.locator(".bc-ref-grade-list")).toContainText("Security architecture");
  await expect(animation.getByTestId("grade-promotion-ladder")).toContainText("L1");
  await expect(animation.getByTestId("grade-promotion-ladder")).toContainText("L2");
  await page.screenshot({path:"test-results/bootcamp-official-grade-promotion.png",animations:"disabled"});
  await animation.getByRole("button",{name:"К новым требованиям"}).click();
  await expect(animation).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspace\/1\?role=product/);
  await expect(page.getByTestId("trajectory-role-detail")).toHaveAttribute("data-role-key","product");
});
