#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root=dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(join(root,name),"utf8");
const report=[];
const data=JSON.parse(read("catalog.json"));
const html=read("index.html"),js=read("app.js"),css=read("styles.css");
assert.equal(data.schema_version,1);
assert.equal(data.total_targets,46);
assert.equal(data.entries.length,46);
assert.equal(data.groups.length,8);
assert.equal(data.groups.reduce((sum,g)=>sum+g.items,0),46);
assert.equal(data.kit_layers_measured,false);
assert.equal(data.meta.certified_pixel_parity,false);
const ids=new Set(),urls=new Set(),groups=new Set(data.groups.map(g=>g.key));
for(let i=0;i<data.entries.length;i++){
 const entry=data.entries[i];
 assert.equal(entry.number,i+1,"Missing sequential index");
 assert.equal(entry.id,"APP-"+String(i+1).padStart(3,"0"));
 assert.ok(!ids.has(entry.id),"Duplicated ID");
 ids.add(entry.id);
 assert.ok(groups.has(entry.category),"Unknown group");
 assert.ok(["P0","P1","P2"].includes(entry.priority),"Invalid priority");
 assert.ok(entry.guideline_url.startsWith("https://developer.apple.com/"),"Non-Apple source");
 assert.ok(["human_interface_guidelines","apple_developer_documentation"].includes(entry.guidance_kind));
 assert.ok(entry.guidance_url_review,"Missing per-URL status");
 assert.equal(entry.source_inspected,false);
 assert.equal(entry.component_pixel_verified,false);
 assert.equal(entry.independent_reviewed,false);
 assert.equal(entry.official_frame_id,null);
 assert.ok(entry.states.length>=3,"Incomplete state contract");
 assert.ok(entry.measures.length>=10,"Missing measurements");
 assert.ok(entry.impulse_touchpoint.startsWith("frontend/"));
 assert.ok(entry.kit_source_keys.length>=1);
 entry.kit_source_keys.forEach(key=>assert.ok(data.kit_sources.some(k=>k.key===key),"Broken kit reference"));
 urls.add(entry.guideline_url);
}
for(const group of data.groups){
 const local="groups/"+group.key+"/README.md";
 assert.ok(existsSync(join(root,local)),"Missing group README "+local);
 assert.equal(data.entries.filter(e=>e.category===group.key).length,group.items);
}
const hostOk=url=>{try{const x=new URL(url);return x.protocol==="https:"&&["developer.apple.com","www.figma.com","www.sketch.com"].includes(x.hostname)}catch{return false}};
for(const kit of data.kit_sources){
 assert.ok(hostOk(kit.url),"Unexpected kit URL host "+kit.url);
 assert.ok(kit.linked_from==="https://developer.apple.com/design/resources/");
 assert.equal(kit.editable_layers_inspected,false);
}
assert.equal(data.kit_sources.filter(k=>k.version==="27").length>=5,true);
const sandbox={window:{}};
runInNewContext(read("data.js"),sandbox);
assert.deepEqual(
 JSON.parse(JSON.stringify(sandbox.window.APPLE_SOURCE_ATLAS)),
 data,
 "Browser catalog must match JSON manifest exactly"
);
const paths=[...js.matchAll(/querySelector\("(#[^"]+)"\)/g)].map(m=>m[1].slice(1));
for(const p of paths)assert.ok(html.includes('id="'+p+'"'),"Missing DOM selector "+p);
assert.match(html,/<script src="data\.js" defer>/);
assert.match(html,/<script src="app\.js" defer>/);
assert.doesNotMatch(html,/<(?:img|script|link)[^>]+(?:src|href)="https?:\/\//i,"No external executable/media dependencies");
assert.doesNotMatch(js,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\s*\(/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/prefers-reduced-transparency/);
assert.ok(read("source-links.csv").trim().split(/\r?\n/).length===47,"CSV must have 46 entries");
assert.ok(JSON.parse(read("source-capture-template.json")).source.source_inspected===false);
report.push("PASS 46 targets, 8 groups, "+urls.size+" Apple guideline URLs, "+data.kit_sources.length+" Apple-linked editable kit pointers");
report.push("PASS 46 unchecked source frames and pixel-fidelity states, explicit per-link access status");
report.push("PASS manifest and offline browser data sync; all group READMEs, input selectors and CSV rows");
report.push("PASS no remote executable dependencies, reduced motion/transparency preferences");
for(const line of report)console.log(line);
