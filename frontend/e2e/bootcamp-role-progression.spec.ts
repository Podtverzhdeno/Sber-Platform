import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test("finishing a saved required Impulse course refreshes the role's learning stage and removes stale demand", async ({ page }) => {
  await installBootcampReferenceApi(page);
  await page.setViewportSize({ width:1448, height:950 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();

  const bootcamp=page.locator(".bc-reference");
  await expect(bootcamp).toBeVisible();
  await expect(bootcamp.getByRole("heading",{name:/Остался.*1.*обязательный.*курс/})).toBeVisible();
  await expect(bootcamp.getByTestId("bootcamp-study-level")).toContainText("0 из 4");
  await expect(bootcamp.getByTestId("bootcamp-official-grade")).toContainText("не присвоен");

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
  await expect(refreshed.getByTestId("bootcamp-official-grade")).toContainText("не присвоен");
  await refreshed.getByRole("button",{name:"Следующий этап"}).click();
  const drawer=page.getByRole("dialog",{name:"Требования к обучению"});
  await expect(drawer.getByText(/Обязательное обучение завершено/)).toBeVisible();
  await expect(drawer.getByText(/Следующий этап развития/)).toBeVisible();
  await page.screenshot({path:"test-results/bootcamp-role-after-course.png",animations:"disabled"});
});

test("an official grade is displayed exclusively from the server's verified projection",async({page})=>{
  await installBootcampReferenceApi(page);
  await page.route("**/api/v1/me/bootcamp/overview?track=product",route=>route.fulfill({json:{
    role_summary:{track_key:"product",grade_state:"known",current_grade_title:"Опубликованный уровень L2"}
  }}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();
  await expect(page.getByTestId("bootcamp-official-grade")).toHaveText(/Опубликованный уровень L2/);
});
