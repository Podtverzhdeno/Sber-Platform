#!/usr/bin/env node
// Static click-audit: lists <button> tags without onClick in JSX sources.
// `type="submit"` inside a form (onSubmit) is a working control: excluded.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(tsx|ts)$/.test(entry) && !/\.test\./.test(entry)) acc.push(full);
  }
  return acc;
}

const dead = [];
let totalForms = 0;
for (const file of walk(root)) {
  const text = readFileSync(file, "utf8");
  const lineStart = (i) => text.slice(0, i).split("\n").length;
  const inForm = (index) => {
    // A submit button is live when the surrounding JSX literal has onSubmit.
    const boundary = Math.max(text.lastIndexOf("<form", index), text.lastIndexOf("</form", index));
    const formOpen = text.lastIndexOf("<form", index);
    const formClose = text.lastIndexOf("</form", index);
    if (formOpen < 0 || (formClose > formOpen && formClose < index)) return false;
    const formTag = text.slice(formOpen, formTagEnd(formOpen));
    return /onSubmit\s*=/.test(formTag);
  };
  const formTagEnd = (open) => {
    const close = text.indexOf(">", open);
    return close === -1 ? open : close + 1;
  };

  for (const m of text.matchAll(/<button[\s\S]*?>/g)) {
    const tag = m[0];
    if (/onClick\s*=/.test(tag)) continue;
    const isSubmit = /type\s*=\s*"submit"/.test(tag);
    if (isSubmit && inForm(m.index)) {
      totalForms += 1;
      continue;
    }
    if (/^<button[^>]*disabled/.test(tag.replace(/\n/g, " ")) && !/type="submit"/.test(tag)) {
      continue; // intentionally disabled with explanation title/aria
    }
    const firstLine = tag.split("\n").map((s) => s.trim()).join(" ").slice(0, 130);
    dead.push(`${file.replace(/\\/g, "/").slice(root.length - 1)}:${lineStart(m.index)}: ${firstLine}`);
  }
}
if (dead.length) console.log(dead.join("\n"));
console.log(`\nDead controls: ${dead.length}  (verified form-submit buttons: ${totalForms})`);
