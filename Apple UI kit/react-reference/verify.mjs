#!/usr/bin/env node
/* Scoped reference-source validator. No Apple frame/pixel or browser QA claimed. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = dirname(fileURLToPath(import.meta.url));
const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];
const required = ["components.tsx", "demo.tsx", "components.test.tsx", "styles.css", "contracts.json", "README.md", "QA_HANDOFF.md"];
for (const name of required) {
  if (!existsSync(join(root, name))) errors.push("Missing " + name);
}
let contracts;
try {
  contracts = JSON.parse(readFileSync(join(root, "contracts.json"), "utf8"));
  if (contracts.production_integrated !== false || contracts.approved_for_pixel_parity !== false || contracts.apple_kit_frames_measured !== false)
    errors.push("Reference-only status incorrectly elevated in contracts.json");
  if (!Array.isArray(contracts.components) || contracts.components.length < 9)
    errors.push("Missing primitive contracts");
} catch (error) {
  errors.push("Invalid contracts.json: " + String(error));
}
let css = "";
try {
  css = readFileSync(join(root, "styles.css"), "utf8");
  if (!css.includes(".aui-kit") || !css.includes("prefers-reduced-motion") ||
      !css.includes("forced-colors") || !css.includes("prefers-reduced-transparency"))
    errors.push("Missing scoped/accessibility CSS fallbacks");
  if (css.match(/(^|})\s*(?:html|body|:root)\s*{/m))
    errors.push("Global CSS override detected in a reference-only stylesheet");
} catch (error) {
  errors.push("Missing styles.css: " + String(error));
}
const badExtensions = new Set([".ttf", ".otf", ".woff", ".woff2", ".sketch", ".fig"]);
for (const name of readdirSync(root)) {
  if (badExtensions.has(extname(name).toLowerCase()))
    errors.push("Review proprietary design asset licensing: " + name);
}
let ts;
try {
  const requireFrontend = createRequire(pathToFileURL(join(root, "..", "..", "frontend", "package.json")));
  ts = requireFrontend("typescript");
} catch {
  warnings.push("TypeScript unavailable under frontend/node_modules; run npm ci in frontend to enable syntax checks.");
  if (strict) errors.push("Strict syntax check requires frontend TypeScript installation.");
}
if (ts) {
  for (const name of ["components.tsx", "demo.tsx", "components.test.tsx"]) {
    const file = join(root, name);
    const source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const diagnostic of ast.parseDiagnostics) {
      const loc = ast.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      errors.push(name + ":" + String(loc.line + 1) + ":" + String(loc.character + 1) +
        " " + ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
    }
  }
}
for (const message of warnings) console.warn("WARNING: " + message);
if (errors.length) {
  for (const message of errors) console.error("FAIL: " + message);
  process.exit(1);
}
console.log("PASS: React reference inventory, contract boundary, CSS fallbacks" +
  (ts ? ", TypeScript TSX syntax" : "") + ".");
console.log("NOT VERIFIED: TypeScript semantic typecheck, Vitest execution, browser visuals, native Apple parity.");
