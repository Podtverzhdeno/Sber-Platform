import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

const failures = [];
if (!html.includes("Content-Security-Policy")) failures.push("CSP meta is missing");
if (!html.includes("object-src 'none'")) failures.push("CSP object-src is not locked down");
if (/<script(?![^>]*\bsrc=)[^>]*>/iu.test(html)) failures.push("inline script found");
if (/\son[a-z]+\s*=/iu.test(html)) failures.push("inline event handler found");
if (/javascript:/iu.test(html)) failures.push("javascript URL found");
if (!styles.includes("prefers-reduced-motion: reduce")) failures.push("reduced-motion fallback missing");

if (failures.length > 0) {
  throw new Error(`Frontend security check failed:\n- ${failures.join("\n- ")}`);
}
console.log("Frontend CSP, inline-code and reduced-motion checks passed");
