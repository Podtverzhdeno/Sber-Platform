#!/usr/bin/env node
// Browser QA against the actual standalone Apple UI kit fidelity workbench.
// Requires: cd frontend && npm ci && npx playwright install chromium
// Run from repo root: node tools/apple-ui-kit-qa/browser-smoke.mjs
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pagePath = join(root, "Apple UI kit", "fidelity-workbench", "index.html");
const output = process.env.APPLE_QA_OUTPUT || join(tmpdir(), "impulse-apple-kit-qa");
assert.ok(existsSync(pagePath), "Missing workbench; branch dependency #189 not yet integrated.");
const frontendRequire = createRequire(join(root, "frontend", "package.json"));
let chromium;
try {
  ({chromium} = frontendRequire("playwright"));
} catch(error) {
  console.error("Run 'cd frontend && npm ci' first; Playwright is an existing frontend dependency.");
  console.error(error.message);
  process.exit(2);
}

const errors = [];
let browser;
try {
  const execPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROME_BIN;
  browser = await chromium.launch({
    headless: true,
    ...(execPath ? {executablePath: execPath} : {})
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: {width: 1440, height: 900},
    reducedMotion: "reduce",
    locale: "ru-RU"
  });
  const page = await context.newPage();
  const remoteRequests = [];
  page.on("request", request => { if (/^https?:\/\//i.test(request.url())) remoteRequests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(pathToFileURL(pagePath).href, {waitUntil: "load"});
  assert.match(await page.title(), /Impulse/i);
  assert.equal(await page.locator("#metric-percent").textContent(), "—");
  assert.equal(await page.locator('[data-mode="diff"]').isDisabled(), true);

  const createPng = async (width,height,target=false) => {
    const data = await page.evaluate(({width,height,target})=>{
      const canvas=document.createElement("canvas");
      canvas.width=width; canvas.height=height;
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#000000";
      ctx.fillRect(0,0,width,height);
      if(target){ctx.fillStyle="#ff0000";ctx.fillRect(width-1,height-1,1,1);}
      return canvas.toDataURL("image/png").split(",")[1];
    },{width,height,target});
    return Buffer.from(data,"base64");
  };
  const pngA=await createPng(2,2);
  const pngB=await createPng(2,2,true);
  const upload = (locator,name,buffer)=>locator.setInputFiles({name,mimeType:"image/png",buffer});

  await upload(page.locator("#source-input"),"reference.png",pngA);
  await upload(page.locator("#target-input"),"impulse.png",pngB);
  await page.waitForFunction(()=>document.querySelector("#metric-percent")?.textContent==="25.00%");
  assert.equal((await page.locator("#metric-different").textContent()).trim(),"1");
  assert.equal((await page.locator("#metric-mae").textContent()).trim(),"21.25");
  assert.equal(await page.locator('[data-mode="diff"]').isDisabled(),false);

  await page.locator('[data-mode="diff"]').click();
  assert.ok(await page.locator("#diff-view").isVisible(),"Diff view should open");

  // Updating tolerance must recompute in place and keep the diff panel visible.
  await page.locator("#threshold").evaluate(el=>{
    el.value="33";
    el.dispatchEvent(new Event("input",{bubbles:true}));
  });
  await page.waitForTimeout(170);
  assert.ok(await page.locator("#diff-view").isVisible(),"Diff view lost after threshold change");
  assert.equal((await page.locator("#threshold-value").textContent()).trim(),"33");

  await mkdir(output,{recursive:true});
  await page.screenshot({path:join(output,"workbench-desktop.png"),fullPage:true,animations:"disabled"});

  // The downloaded JSON must record pixel-level evidence and unverified provenance.
  const event=page.waitForEvent("download");
  await page.locator("#export-json").click();
  const download=await event;
  const payload=JSON.parse(await readFile(await download.path(),"utf8"));
  assert.equal(payload.results.total_pixels,4);
  assert.equal(payload.results.different_pixels,1);
  assert.equal(payload.results.percent_changed,25);
  assert.equal(payload.threshold_max_channel_delta,33);
  assert.equal(payload.verified_official_apple_source,false);

  const pngEvent = page.waitForEvent("download");
  await page.locator("#export-png").click();
  const heatmapDownload = await pngEvent;
  const pngBuffer = await readFile(await heatmapDownload.path());
  assert.ok(pngBuffer.length > 32,"Empty heatmap PNG");
  assert.equal(pngBuffer.subarray(0,8).toString("hex"),"89504e470d0a1a0a","Invalid PNG signature");

  // A wrong-size image must prevent numeric comparisons and reports.
  await upload(page.locator("#target-input"),"wrong-size.png",await createPng(3,2,true));
  await page.waitForFunction(()=>document.querySelector("#status")?.textContent==="Разный размер изображений");
  assert.equal(await page.locator('[data-mode="diff"]').isDisabled(),true);
  assert.equal(await page.locator("#export-json").isDisabled(),true);
  assert.equal(await page.locator("#export-png").isDisabled(),true);
  assert.equal((await page.locator("#metric-percent").textContent()).trim(),"—");

  // Responsive constraints and keyboard focus.
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(output,"workbench-mobile.png"),fullPage:true,animations:"disabled"});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=1,"Horizontal overflow on 390px: "+overflow);

  assert.deepEqual(errors,[], "Browser page errors");
  assert.deepEqual(remoteRequests,[], "Workbench unexpectedly made network requests");
  console.log("PASS: image upload, 25% pixel diff, RGB MAE, threshold state, JSON export, dimension guard, mobile overflow");
  console.log("Screenshots:",output);
  await context.close();
} catch(error) {
  console.error("FAIL:",error.stack||error.message);
  process.exitCode=1;
} finally {
  if(browser) await browser.close();
}
