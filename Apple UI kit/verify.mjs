#!/usr/bin/env node
/**
 * Standalone Apple UI kit reference structure/provenance verifier.
 * Run: node "Apple UI kit/verify.mjs" from repo root.
 * No network, no third-party modules and no Apple binaries.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(root,name),"utf8");
const core = ["README.md","sources.md","assets-and-licenses.md","acceptance.md","gallery.html","gallery.css","gallery.js","compare.html","compare.css","compare.js","tokens.css","reference-manifest.json","measurement-ledger.csv","measurements-guide.md","visual-references.md","WWDC-official-study.md"];
const families = ["01-Liquid-Glass","02-Navigation","03-Controls","04-Forms-Search","05-Overlays-Feedback","06-Content-Data","07-Typography-Color-Icons","08-Responsive-Accessibility","09-Applications-Patterns"];
for (const path of core) assert.ok(read(path).length>10, "Missing or empty "+path);
for (const folder of families) assert.ok(read(join(folder,"README.md")).length>300, "Missing category "+folder);
const manifest = JSON.parse(read("reference-manifest.json"));
assert.equal(manifest.schemaVersion,1);
assert.ok(manifest.sources.length>=30);
const ids = new Set();
for (const source of manifest.sources) {
  assert.ok(source.id && !ids.has(source.id),"Duplicate/empty ID "+source.id);
  ids.add(source.id);
  assert.ok(source.family && families.includes(source.family),"Source category incorrect: "+source.id);
  assert.match(source.url,/^https:\/\//);
  assert.equal(source.assetLocal,false,"Unexpected local licensed asset "+source.id);
}
const csv = read("measurement-ledger.csv").trim().split(/\r?\n/).map(x=>x.split(","));
assert.equal(csv[0].length,32,"Measurement schema drift");
for(let i=1;i<csv.length;i++)assert.equal(csv[i].length,csv[0].length,"Incorrect CSV column count on row "+(i+1));
assert.equal(csv[0].indexOf("impulse_path"),26);
const gallery = read("gallery.html"), comparator = read("compare.html");
for (const id of ["theme","menuButton","menu","search","showDialog","feedbackDialog","dialog","range","progress","apply","secondary","danger","toast"]) {
  assert.ok(gallery.includes('id="'+id+'"'),"Gallery missing DOM control "+id);
}
for (const id of ["reference","actual","mode","screen","opacity","threshold","report","dimensions","mae","pixels","status"]) {
  assert.ok(comparator.includes('id="'+id+'"'),"Comparator missing DOM control "+id);
}
for (const [doc,files] of [[gallery,["tokens.css","gallery.css","gallery.js"]],[comparator,["tokens.css","compare.css","compare.js"]]]) {
  for(const path of files)assert.ok(doc.includes('"'+path+'"'),"Broken standalone asset dependency "+path);
  assert.doesNotMatch(doc,/<script[^>]+src=["']https?:/i,"No network scripts permitted");
}
assert.match(read("gallery.css"),/prefers-reduced-motion/);
assert.match(read("gallery.css"),/prefers-reduced-transparency/);
assert.match(read("gallery.css"),/forced-colors/);
assert.match(read("compare.js"),/differentPercent/);
assert.match(read("compare.js"),/meanAbsoluteError/);
assert.ok(read("README.md").includes("01-Liquid-Glass"));
assert.ok(read("README.md").includes("compare.html"));
const disallowed = [];
function walk(path) {
  for(const name of readdirSync(path)){
    const sub=join(path,name);
    if(statSync(sub).isDirectory())walk(sub);
    else if(/\.(ttf|otf|woff2?|sketch|fig|png|jpe?g|webp)$/i.test(name))disallowed.push(sub);
  }
}
walk(root);
assert.deepEqual(disallowed,[],"Unreviewed binary image/font/library detected (check license policy)");
const node = process.execPath;
for(const file of ["gallery.js","compare.js"]){
  const syntax=spawnSync(node,["--check",join(root,file)],{encoding:"utf8"});
  assert.equal(syntax.status,0,"JS syntax error "+file+" "+syntax.stderr);
}
console.log("Apple UI kit verified:",families.length,"categories,",manifest.sources.length,"official URLs,",csv.length-1,"measurement rows; two gallery tools checked.");
