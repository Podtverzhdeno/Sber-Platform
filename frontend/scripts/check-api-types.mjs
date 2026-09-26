import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "impulse-api-types-"));
const generated = join(temporaryDirectory, "schema.ts");

try {
  const command = process.execPath;
  const cli = join(projectRoot, "node_modules", "openapi-typescript", "bin", "cli.js");
  const result = spawnSync(
    command,
    [cli, "../openapi.json", "-o", generated],
    { cwd: projectRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? String(result.error ?? "generation failed"));
    process.exit(result.status ?? 1);
  }

  const committed = readFileSync(join(projectRoot, "src/api/schema.ts"), "utf8");
  const candidate = readFileSync(generated, "utf8");
  if (committed !== candidate) {
    console.error("Generated API types are stale; run: npm run api:generate");
    process.exit(1);
  }
  console.log("Generated API types are current");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
