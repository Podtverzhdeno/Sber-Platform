import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

async function productTrajectoryFixture(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({ json: {
    ...overviewFixture,
    roles: [...overviewFixture.roles, { track_key:"product",title:"AI Architect",state:"active",attempt_number:1,completed_milestones:0,total_milestones:2 }],
  } }));
}

async function completeCourseThroughApi(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const csrf=sessionStorage.getItem("impulse_csrf")??"";
    const url="/api/v1/me/bootcamp/impulse-study/demo-course-1";
    for(let index=0; index<8;index++) {
      const response=await fetch(url+"/lessons/"+String(index)+"/complete",{
        method:"POST",headers:{"X-CSRF-Token":csrf},
      });
      if(!response.ok) throw new Error("Lesson "+String(index)+" rejected: "+String(response.status));
    }
    const finish=await fetch(url+"/finish",{method:"POST",headers:{"X-CSRF-Token":csrf}});
    if(!finish.ok)throw new Error("Finish rejected: "+String(finish.status));
  });
}
async function openBootcamp(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();
  await expect(page.locator(".bc-reference")).toBeVisible();
}

test("a persisted course certificate completes learning only and opens the practical next step",async({page})=>{
  await installBootcampReferenceApi(page);
  await productTrajectoryFixture(page);
  await page.setViewportSize({width:1448,height:950});
  await openBootcamp(page);
  const bootcamp=page.locator(".bc-reference");
  await expect(bootcamp.getByTestId("bootcamp-study-level")).toContainText("L0 · цикл 1");
  await expect(bootcamp.getByRole("heading",{name:/Остался.*1.*обязательный.*курс/})).toBeVisible();
  await expect(bootcamp.getByTestId("bootcamp-official-grade")).toContainText("правила не опубликованы");

  await completeCourseThroughApi(page);
  await page.reload();
  await expect(bootcamp.getByRole("heading",{name:"Учебная часть завершена"})).toBeVisible();
  await expect(bootcamp.getByTestId("bootcamp-study-level")).toContainText("L0 · цикл 1");
  await expect(bootcamp.getByTestId("bootcamp-study-count")).toHaveText("1");
  await expect(bootcamp.getByTestId("bootcamp-next-stage")).toContainText("практику");
  await expect(bootcamp.getByTestId("bootcamp-official-grade")).toContainText("правила не опубликованы");
  await expect(page.getByTestId("grade-milestone-celebration")).toHaveCount(0);
  const practice=bootcamp.getByRole("button",{name:"Выбрать практическую задачу"});
  await expect(practice).toBeEnabled();
  await practice.click();
  await expect(page).toHaveURL(/study=practice/);
  await expect(page.getByTestId("impulse-immersive-reader")).toBeVisible();
});

test("a professional career grade appears only from the development overview issuer",async({page})=>{
  await installBootcampReferenceApi(page);
  await page.route("**/api/v1/participant/me/development-overview",route=>route.fulfill({json:{
    ...overviewFixture,concepts:{...overviewFixture.concepts,
      career_grade:{...overviewFixture.concepts.career_grade,state:"known",
        current_grade:"Опубликованный уровень L2"}},
  }}));
  await openBootcamp(page);
  await expect(page.getByTestId("bootcamp-official-grade")).toContainText("Опубликованный уровень L2");
  await expect(page.getByTestId("bootcamp-study-level")).toContainText("L0 · цикл 1");
  await expect(page.getByTestId("grade-milestone-celebration")).toHaveCount(0);
});

test("finishing inside the course reader updates the learning requirements without reloading",async({page})=>{
  await installBootcampReferenceApi(page);
  await page.setViewportSize({width:1448,height:950});
  await openBootcamp(page);
  const bootcampPath=new URL(page.url()).pathname;
  await page.goto(bootcampPath+"?course=demo-course-1");
  const reader=page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  await reader.getByRole("button",{name:/Перейти к программе/}).click();
  await reader.locator(".imp-study__program-list button").first().click();
  for(let index=0;index<8;index++) await reader.locator(".imp-study__navigation .imp-study__primary").click();
  await expect(reader.getByRole("heading",{name:"Завершение обучения"})).toBeVisible();
  await reader.locator(".imp-study__finish").click();
  await expect(reader.getByRole("heading",{name:"Обучение завершено!"})).toBeVisible();
  const popup=page.getByTestId("grade-milestone-celebration");
  await expect(popup).toHaveAttribute("data-mode","course-complete");
  await popup.getByRole("button",{name:"Вернуться к курсу"}).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Учебная часть завершена"})).toBeVisible();
  await expect(page.getByTestId("bootcamp-study-level")).toContainText("L0 · цикл 1");
  await expect(page.getByTestId("bootcamp-next-stage")).toContainText("практику");
  await expect(page.getByTestId("bootcamp-official-grade")).toContainText("правила не опубликованы");
});

test("completing lessons cannot fabricate a career-grade celebration",async({page})=>{
  await installBootcampReferenceApi(page);
  await productTrajectoryFixture(page);
  await openBootcamp(page);
  await expect(page.getByTestId("bootcamp-official-grade")).toContainText("правила не опубликованы");
  await completeCourseThroughApi(page);
  await page.reload();
  await expect(page.getByTestId("bootcamp-study-level")).toContainText("L0 · цикл 1");
  await expect(page.getByTestId("grade-milestone-celebration")).toHaveCount(0);
  await expect(page.getByTestId("bootcamp-official-grade")).toContainText("правила не опубликованы");
  await expect(page.getByRole("button",{name:"Выбрать практическую задачу"})).toBeVisible();
});
