#!/usr/bin/env node
// Optional end-to-end browser smoke. Uses already-present frontend Playwright dependency.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";

const root=dirname(fileURLToPath(import.meta.url));
const repo=resolve(root,"../..");
const frontendRequire=createRequire(join(repo,"frontend","package.json"));
let chromium;
try{({chromium}=frontendRequire("playwright"));}
catch(error){console.error("Playwright unavailable. Run 'cd frontend && npm ci', then retry.");console.error(error.message);process.exit(2);}
const screenshots=process.env.APPLE_ATLAS_SCREENSHOTS||join(tmpdir(),"impulse-apple-official-atlas");
await mkdir(screenshots,{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:900},locale:"ru-RU",reducedMotion:"reduce"});
 const page=await context.newPage();
 const network=[],errors=[];
 page.on("request",r=>{if(/^https?:\/\//.test(r.url()))network.push(r.url());});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(pathToFileURL(join(root,"index.html")).href,{waitUntil:"load"});
 assert.match(await page.title(),/Impulse/i);
 assert.equal(await page.locator(".case-card").count(),46,"Expected 46 reference cards");
 assert.equal(await page.locator("#kits .kit-card").count(),7);
 assert.equal(await page.locator("#category option").count(),9);
 await page.locator("#search").fill("Popover");
 assert.equal(await page.locator(".case-card").count(),2,"Popover keyword should find title and family cases");
 await page.locator("#search").fill("no-such-component-xyz");
 assert.equal(await page.locator(".case-card").count(),0);
 assert.ok(await page.locator("#empty").isVisible());
 await page.locator("#search").fill("");
 await page.locator('[data-priority="P0"]').click();
 const priorityCards=await page.locator(".case-card").count();
 assert.ok(priorityCards>0 && priorityCards<46);
 const wrongPriority=await page.locator(".case-card .priority:not(.p0)").count();
 assert.equal(wrongPriority,0);
 await page.locator('[data-priority=""]').click();
 await page.locator("#category").selectOption("07-messages-attachments");
 assert.equal(await page.locator(".case-card").count(),3);
 await page.locator("#category").selectOption("");
 const detail=page.locator(".case-card details").first();
 await detail.locator("summary").click();
 assert.ok(await detail.locator("p").first().isVisible());
 const external=page.locator(".case-card a[target='_blank']").first();
 assert.equal(await external.getAttribute("rel"),"noopener noreferrer");
 // Capture the default catalog from the top. Tests above scroll to cards:
 // otherwise a sticky header can be painted halfway down the full-page PNG.
 await detail.locator("summary").click();
 assert.equal(await detail.evaluate(el=>el.open),false,"Restore collapsed default details for evidence");
 const resetScroll = async () => {
  await page.evaluate(()=>{
   document.documentElement.style.scrollBehavior="auto";
   window.scrollTo({top:0,left:0,behavior:"instant"});
  });
  await page.waitForFunction(()=>window.scrollY===0);
 };
 await resetScroll();
 await page.screenshot({path:join(screenshots,"atlas-desktop.png"),fullPage:true,animations:"disabled"});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  await resetScroll();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=1,"Horizontal overflow at "+width+": "+overflow);
  await page.screenshot({path:join(screenshots,"atlas-"+width+".png"),fullPage:true,animations:"disabled"});
 }
 assert.deepEqual(network,[],"No external requests should occur on page render");
 assert.deepEqual(errors,[],"No page errors");
 console.log("PASS: 46 cards, 7 kits, 8 groups, search, priority, category, details, offline assets, mobile 390/320");
 console.log("Screenshots:",screenshots);
 await context.close();
}catch(e){console.error("FAIL:",e.stack||e.message);process.exitCode=1;}
finally{if(browser)await browser.close();}
