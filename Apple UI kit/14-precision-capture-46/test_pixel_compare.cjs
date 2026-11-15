#!/usr/bin/env node
"use strict";
/**
 * Dependency-free math regression for the self-contained local pixel comparator.
 * Run: node "Apple UI kit/14-precision-capture-46/test_pixel_compare.cjs"
 * This checks RGBA math only. Browser controls and actual Apple screenshot parity
 * are separate and not certified by this test.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const html = fs.readFileSync(path.join(__dirname, "pixel-compare.html"), "utf8");

const match = html.match(/function differences\([\s\S]*?\n}\nfunction draw/);
assert(match, "difference function must remain present in the HTML");
const fnText = match[0].replace(/\nfunction draw$/, "");
const diff = vm.runInNewContext(fnText + "\ndifferences;", {
  Math, Uint8ClampedArray, Error
}, {timeout: 2000});

const a = {width: 2, height: 1, data: new Uint8ClampedArray([0,0,0,255, 10,20,30,255])};
const b = {width: 2, height: 1, data: new Uint8ClampedArray([0,0,0,255, 20,20,30,255])};

const identical = diff(a,a,0);
assert.equal(identical.changed,0);
assert.equal(identical.mae,0);
assert.equal(identical.ratio,0);
assert.equal(identical.heat.length,8);

const strict = diff(a,b,0);
assert.equal(strict.changed,1);
assert.equal(strict.ratio,.5);
assert.equal(strict.mae,1.25);
assert.equal(strict.heat[4],255);
assert.equal(strict.heat[5],35);
assert.equal(strict.heat[6],40);

const tolerated = diff(a,b,10);
assert.equal(tolerated.changed,0);
assert.equal(tolerated.mae,1.25); // tolerance does not hide actual MAE

const transparent = {width:2,height:1,data:new Uint8ClampedArray([0,0,0,255,10,20,30,0])};
assert.equal(diff(a,transparent,0).changed,1);
assert.equal(diff(a,transparent,0).mae,255/8);

assert.throws(() => diff(a,{...b,width:3},0),/Размеры изображений различаются/);
assert.throws(() => diff(a,{...b,data:new Uint8ClampedArray([0,0,0,255])},0),/RGBA/);
assert.throws(() => diff({width:16000001,height:1,data:new Uint8ClampedArray(0)},
  {width:16000001,height:1,data:new Uint8ClampedArray(0)},0),/максимум 16 млн/);

assert(html.includes("URL.createObjectURL"),"local file-only input expected");
assert(!/<script\b[^>]*\bsrc=/i.test(html),"do not load external JS");
assert(html.includes("pixel_parity_certified:false"),"do not falsely certify pixel parity");
assert(html.includes('href="../PIXEL_PARITY_QA.md"'),"link to parent QA specification should work");
console.log("PASS: 7 numerical/guard scenarios, local-only source, truthful evidence metadata");
