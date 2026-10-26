import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

test("Bootcamp keeps server primary AI role golden while choosing another direction", async ({page}) => {
  await page.setViewportSize({width:1512,height:900});
  await installBootcampReferenceApi(page);
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({json:{
    ...overviewFixture,
    next_outcome:{...overviewFixture.next_outcome,trajectory_key:"ml"},
    roles:[
      {track_key:"product",title:"AI Architect",state:"active",attempt_number:1,completed_milestones:0,total_milestones:4},
      {track_key:"ml",title:"AI Engineer",state:"active",attempt_number:2,completed_milestones:1,total_milestones:4},
    ],
  }}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();
  const bar=page.getByRole("group",{name:"Направление обучения"});
  const primary=bar.getByRole("button",{name:"AI Engineer"});
  const architect=bar.getByRole("button",{name:"AI Architect"});
  const security=bar.getByRole("button",{name:"AI Security Engineer"});
  await expect(primary).toHaveAttribute("data-primary","true");
  await expect(primary).toHaveAttribute("aria-description","Основное направление");
  await expect(primary).toHaveAttribute("aria-pressed","false");
  await expect(architect).toHaveAttribute("aria-pressed","true");
  await expect(architect).toHaveAttribute("data-primary","false");
  await expect(primary).toHaveCSS("border-top-color","rgb(215, 163, 68)");
  await page.screenshot({path:"test-results/bootcamp-main-direction-gold.png",fullPage:false,animations:"disabled"});

  await primary.click();
  await expect(primary).toHaveAttribute("aria-pressed","true");
  await expect(primary).toHaveAttribute("data-primary","true");
  await expect(primary).toHaveCSS("border-top-color","rgb(255, 208, 111)");

  await security.click();
  await expect(security).toHaveAttribute("aria-pressed","true");
  await expect(primary).toHaveAttribute("aria-pressed","false");
  await expect(primary).toHaveAttribute("data-primary","true");
  await expect(security).toHaveAttribute("data-primary","false");
  await expect(primary).toHaveCSS("border-top-color","rgb(215, 163, 68)");
});

test("Bootcamp never guesses a golden main role for unenrolled users", async ({page}) => {
  await installBootcampReferenceApi(page);
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({json:{
    ...overviewFixture,
    roles:[{track_key:"product",title:"AI Architect",state:"unselected",attempt_number:null,completed_milestones:0,total_milestones:0}],
  }}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link",{name:"Bootcamp"}).click();
  const bar=page.getByRole("group",{name:"Направление обучения"});
  await expect(bar.locator('[data-primary="true"]')).toHaveCount(0);
  await expect(bar.getByRole("button",{name:"AI Architect"})).toHaveAttribute("aria-pressed","true");
});
