import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  boardEntries,
  cliUsage,
  CoordinationError,
  dispatch,
  isHeartbeatStale,
  normalizeScope,
  parseHeartbeat,
  readTaskLine,
  statusFilePath,
  statusTimestamp,
  StatusFile,
} from "./coordination-cli.mjs";

const CURRENT = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(CURRENT, "coordination-cli.mjs");

const NOW = new Date("2026-10-20T12:00:00+03:00");
const FRESH = statusTimestamp(new Date(NOW.getTime() - 10 * 60 * 1000));
const STALE = statusTimestamp(new Date(NOW.getTime() - 120 * 60 * 1000));

function makeSandbox(existing = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coord-cli-"));
  fs.mkdirSync(path.join(root, "openspec", "changes", "impulse-ecosystem"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "openspec", "changes", "impulse-ecosystem", "tasks.md"),
    "- [ ] 99.1 задача песочницы\n- [x] 99.2 закрытая задача\n- [ ] 100.1 соседняя\n- [ ] 100.2 вторая\n",
    "utf8",
  );
  fs.mkdirSync(path.join(root, ".agents", "coordination", "claims"), { recursive: true });
  for (const [lockName, body] of existing) {
    const dir = path.join(root, ".agents", "coordination", "claims", lockName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "status.md"), body, "utf8");
  }
  return root;
}

function readClaim(root, taskId) {
  return fs.readFileSync(statusFilePath(root, taskId), "utf8");
}

function claimBody(sessionId, scopes, heartbeat) {
  return [
    "# Claim sandbox",
    "",
    `- session_id: ${sessionId}`,
    "- status: IN_PROGRESS",
    `- heartbeat_at: ${heartbeat}`,
    "- write_scope:",
    ...scopes.map((scope) => `  - ${scope}`),
    "",
  ].join("\n");
}

test("claim создаёт lock атомарно, шаблон по протоколу, повтор — fail", () => {
  const root = makeSandbox();
  const first = dispatch(["claim", "99.1", "--session", "s1", "--scope", "frontend/a.ts", "--root", root, "--now", FRESH]);
  assert.equal(first.code, 0);
  const text = readClaim(root, "99.1");
  assert.match(text, /- session_id: s1/);
  assert.match(text, /- status: IN_PROGRESS/);
  assert.match(text, /- started_at: /);
  assert.match(text, /- base_revision: (unknown|.+)/);
  assert.match(text, /  - frontend\/a\.ts/);
  assert.match(text, /- depends_on:/);
  assert.ok(!readTaskLine("- [ ] 99.1 задача", "99.1")?.checked);
  const second = dispatch(["claim", "99.1", "--session", "s2", "--scope", "frontend/b.ts", "--root", root, "--now", FRESH]);
  assert.equal(second.code, 2);
  assert.match(second.output, /CALL_claim: TASK_ALREADY_CLAIMED/);
});

test("конкурентные claim-подпроцессы одного task ID: ровно один success", async () => {
  const root = makeSandbox();
  const attempts = [
    new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, "claim", "99.1", "--scope", "x.ts", "--session", "proc-a", "--root", root]);
      let out = "";
      child.stderr.on("data", (chunk) => {
        out += String(chunk);
      });
      child.on("exit", (code) => resolve({ code, out }));
    }),
    new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, "claim", "99.1", "--scope", "y.ts", "--session", "proc-b", "--root", root]);
      let out = "";
      child.stderr.on("data", (chunk) => {
        out += String(chunk);
      });
      child.on("exit", (code) => resolve({ code, out }));
    }),
  ];
  const runs = await Promise.all(attempts);
  const codes = runs.map((run) => run.code).sort();
  assert.deepEqual(codes, [0, 2]);
  const loser = runs.find((run) => run.code === 2);
  assert.match(loser.out, /TASK_ALREADY_CLAIMED/);
  const winner = runs.find((run) => run.code === 0);
  assert.match(loser.out, /99\.1: lock уже существует/);
  assert.match(readClaim(root, "99.1"), /- session_id: (proc-a|proc-b)/);
});

test("parent/child scope конфликт: включение в обе стороны и sibling свободен", () => {
  const existingName = "100.1.lock";
  const root = makeSandbox([[existingName, claimBody("parent-owner", ["frontend/src/features", "tests/test_conflict.py"], FRESH)]]);
  const same = dispatch(["claim", "100.2", "--session", "child-try", "--scope", "frontend\\src\\features", "--root", root, "--now", FRESH]);
  assert.equal(same.code, 2);
  assert.match(same.output, /CALL_claim: SCOPE_CONFLICT/);
  assert.match(same.output, /100\.1 \(parent-owner, IN_PROGRESS\): пересечение на frontend\/src\/features/);
  const child = dispatch(["claim", "100.2", "--session", "child-try", "--scope", "frontend/src/features/inner.ts", "--root", root, "--now", FRESH]);
  assert.equal(child.code, 2);
  const ancestor = dispatch(["claim", "100.2", "--session", "child-try", "--scope", "frontend", "--root", root, "--now", FRESH]);
  assert.equal(ancestor.code, 2);
  const sibling = dispatch(["claim", "100.2", "--session", "child-try", "--scope", "frontend/src/other", "--root", root, "--now", FRESH]);
  assert.equal(sibling.code, 0);
});

test("claim блокируется DONE-пунктом, отсутствием scope и конфликтом BLOCKED claim", () => {
  const locked = "98.1.lock";
  const root = makeSandbox([
    [locked, claimBody("other-owner", ["src/impulse/api"], FRESH).replace("- status: IN_PROGRESS", "- status: BLOCKED")],
  ]);
  const done = dispatch(["claim", "99.2", "--session", "s1", "--scope", "x.ts", "--root", root, "--now", FRESH]);
  assert.equal(done.code, 2);
  assert.match(done.output, /CALL_claim: TASK_DONE/);
  const unknown = dispatch(["claim", "77.7", "--session", "s1", "--scope", "x.ts", "--root", root, "--now", FRESH]);
  assert.equal(unknown.code, 2);
  assert.match(unknown.output, /CALL_claim: TASK_UNKNOWN/);
  const noScope = dispatch(["claim", "99.1", "--session", "s1", "--root", root, "--now", FRESH]);
  assert.equal(noScope.code, 2);
  assert.match(noScope.output, /CALL_claim: MISSING_FLAG/);
  const conflict = dispatch(["claim", "99.1", "--session", "s1", "--scope", "src/impulse/api/v1/x.py", "--root", root, "--now", FRESH]);
  assert.equal(conflict.code, 2);
  assert.match(conflict.output, /98\.1 \(other-owner, BLOCKED\)/);
  const free = dispatch(["claim", "99.1", "--session", "s1", "--scope", "tests/test_free.py", "--root", root, "--now", FRESH]);
  assert.equal(free.code, 0);
});

test("heartbeat обновляет поле, SESSION_MISMATCH отклоняется", () => {
  const root = makeSandbox();
  dispatch(["claim", "99.1", "--session", "owner", "--scope", "a.ts", "--root", root, "--now", FRESH]);
  const stranger = dispatch(["heartbeat", "99.1", "--root", root, "--session", "attacker", "--now", FRESH]);
  assert.equal(stranger.code, 2);
  assert.match(stranger.output, /CALL_heartbeat: SESSION_MISMATCH/);
  const ok = dispatch(["heartbeat", "99.1", "--root", root, "--session", "owner", "--now", STALE]);
  assert.equal(ok.code, 0);
  assert.equal(new StatusFile(readClaim(root, "99.1")).field("heartbeat_at"), STALE);
});

test("REVIEW/BLOCKED в status требуют note; foreign-session не пишет", () => {
  const root = makeSandbox();
  dispatch(["claim", "99.1", "--session", "owner", "--scope", "a.ts", "--root", root, "--now", FRESH]);
  const noNote = dispatch(["status", "99.1", "REVIEW", "--root", root, "--now", FRESH]);
  assert.equal(noNote.code, 2);
  assert.match(noNote.output, /CALL_status: NOTE_REQUIRED/);
  const foreign = dispatch(["status", "99.1", "IN_PROGRESS", "--note", "захват", "--session", "attacker", "--root", root, "--now", FRESH]);
  assert.equal(foreign.code, 2);
  assert.match(foreign.output, /CALL_status: SESSION_MISMATCH/);
  const review = dispatch(["status", "99.1", "REVIEW", "--note", "реализация готова", "--root", root, "--now", FRESH]);
  assert.equal(review.code, 0);
  assert.equal(new StatusFile(readClaim(root, "99.1")).field("status"), "REVIEW");
  const badStatus = dispatch(["status", "99.1", "FROZN", "--note", "x", "--root", root, "--now", FRESH]);
  assert.equal(badStatus.code, 2);
  assert.match(badStatus.output, /CALL_status: STATUS_INVALID/);
});

test("review: self-review запрет, PASS→DONE, CHANGES_REQUIRED→BLOCKED с note", () => {
  const root = makeSandbox();
  dispatch(["claim", "99.1", "--session", "author", "--scope", "a.ts", "--root", root, "--now", FRESH]);
  dispatch(["status", "99.1", "REVIEW", "--note", "готово", "--root", root, "--now", FRESH]);
  const self = dispatch(["review", "99.1", "--verdict", "PASS", "--reviewer", "author", "--root", root, "--now", FRESH]);
  assert.equal(self.code, 2);
  assert.match(self.output, /CALL_review: SELF_REVIEW/);
  const changes = dispatch([
    "review",
    "99.1",
    "--verdict",
    "CHANGES_REQUIRED",
    "--reviewer",
    "reviewer-1",
    "--root",
    root,
    "--now",
    FRESH,
  ]);
  assert.equal(changes.code, 2);
  assert.match(changes.output, /CALL_review: NOTE_REQUIRED/);
  const blocked = dispatch([
    "review",
    "99.1",
    "--verdict",
    "CHANGES_REQUIRED",
    "--note",
    "дополнить e2e withdraw",
    "--reviewer",
    "reviewer-1",
    "--root",
    root,
    "--now",
    FRESH,
  ]);
  assert.equal(blocked.code, 0);
  const afterBlock = new StatusFile(readClaim(root, "99.1"));
  assert.equal(afterBlock.field("status"), "BLOCKED");
  assert.match(afterBlock.text, /verdict=CHANGES_REQUIRED/);
  assert.match(afterBlock.text, /дополнить e2e/);
  dispatch(["status", "99.1", "REVIEW", "--note", "исправлено", "--root", root, "--now", FRESH]);
  const passed = dispatch(["review", "99.1", "--verdict", "PASS", "--reviewer", "reviewer-1", "--root", root, "--now", FRESH]);
  assert.equal(passed.code, 0);
  const afterPass = new StatusFile(readClaim(root, "99.1"));
  assert.equal(afterPass.field("status"), "DONE");
  assert.match(afterPass.text, /reviewed_at: /);
  assert.match(afterPass.text, /checkbox flip/);
});

test("review требует свежий heartbeat автора", () => {
  const root = makeSandbox();
  dispatch(["claim", "99.1", "--session", "author", "--scope", "a.ts", "--root", root, "--now", FRESH]);
  dispatch(["status", "99.1", "REVIEW", "--note", "готово", "--root", root, "--now", FRESH]);
  dispatch(["heartbeat", "99.1", "--root", root, "--session", "author", "--now", STALE]);
  const result = dispatch(["review", "99.1", "--verdict", "PASS", "--reviewer", "reviewer-1", "--root", root, "--now", NOW.toISOString()]);
  assert.equal(result.code, 2);
  assert.match(result.output, /CALL_review: STALE_HEARTBEAT/);
});

test("release доступен только владельцу; после release lock убран и задача снова claimable", () => {
  const root = makeSandbox();
  dispatch(["claim", "99.1", "--session", "owner", "--scope", "a.ts", "--root", root, "--now", FRESH]);
  const foreign = dispatch(["release", "99.1", "--session", "attacker", "--reason", "нельзя", "--root", root]);
  assert.equal(foreign.code, 2);
  assert.match(foreign.output, /CALL_release: SESSION_MISMATCH/);
  fs.writeFileSync(path.join(root, "openspec", "changes", "impulse-ecosystem", "tasks.md"), "- [ ] 99.1 задача песочницы\n", "utf8");
  const own = dispatch(["release", "99.1", "--session", "owner", "--reason", "scope расширен", "--root", root]);
  assert.equal(own.code, 0);
  assert.ok(!fs.existsSync(path.join(root, ".agents", "coordination", "claims", "99.1.lock")));
  const reclaim = dispatch(["claim", "99.1", "--session", "owner", "--scope", "a.ts,extra.ts", "--root", root, "--now", FRESH]);
  assert.equal(reclaim.code, 0);
  const state = new StatusFile(readClaim(root, "99.1"));
  assert.equal(state.field("status"), "IN_PROGRESS");
  assert.equal(state.scopes()[0], "a.ts,extra.ts");
});

test("claim автоматически освобождает легаси RELEASED lock-каталог", () => {
  const root = makeSandbox();
  const dir = path.join(root, ".agents", "coordination", "claims", "99.1.lock");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "status.md"), `${claimBody("old", ["a.ts"], FRESH)}- release: предфикс до багфикса\n`.replace("- status: IN_PROGRESS", "- status: RELEASED"), "utf8");
  const claimed = dispatch(["claim", "99.1", "--session", "owner", "--scope", "b.ts", "--root", root, "--now", FRESH]);
  assert.equal(claimed.code, 0);
  const state = new StatusFile(readClaim(root, "99.1"));
  assert.equal(state.field("status"), "IN_PROGRESS");
  assert.ok(!state.text.includes("предфикс до багфикса"));
});

test("boardEntries помечает stale только у активных claims", () => {
  const root = makeSandbox([
    ["98.1.lock", claimBody("old-session", ["frontend/legacy.ts"], STALE)],
    [
      "98.2.lock",
      claimBody("done-owner", ["frontend/done.ts"], STALE).replace("- status: IN_PROGRESS", "- status: DONE"),
    ],
  ]);
  dispatch(["claim", "99.1", "--session", "live", "--scope", "frontend/new.ts", "--root", root, "--now", FRESH]);
  const entries = boardEntries(root, NOW);
  assert.equal(entries.length, 3);
  const staleEntry = entries.find((entry) => entry.taskId === "98.1");
  assert.ok(staleEntry);
  assert.equal(staleEntry.stale, true);
  const doneEntry = entries.find((entry) => entry.taskId === "98.2");
  assert.ok(doneEntry);
  assert.equal(doneEntry.stale, false);
  const live = entries.find((entry) => entry.taskId === "99.1");
  assert.ok(live);
  assert.equal(live.stale, false);
  assert.deepEqual(live.scopes, ["frontend/new.ts"]);
});

test("check печатает CONFLICT и STALE_CANDIDATE, exit code 1", () => {
  const root = makeSandbox([
    ["100.1.lock", claimBody("owner", ["frontend/src/features"], STALE)],
  ]);
  dispatch(["claim", "100.2", "--session", "other", "--scope", "analytics", "--root", root, "--now", FRESH]);
  const clean = dispatch(["check", "100.2", "--root", root, "--now", NOW.toISOString()]);
  assert.equal(clean.code, 0);
  assert.match(clean.output, /CHECK 100\.2 ok/);
  const conflict = dispatch([
    "check",
    "100.2",
    "--scope",
    "frontend/src/features/team.ts",
    "--root",
    root,
    "--now",
    NOW.toISOString(),
  ]);
  assert.equal(conflict.code, 1);
  assert.match(conflict.output, /CONFLICT .*STALE_CANDIDATE/);
  assert.match(conflict.output, /CHECK 100\.2 BLOCKED/);
});

test("normalizeScope/parseHeartbeat/статусы контракты", () => {
  assert.equal(normalizeScope("  frontend\\src\\features/"), "frontend/src/features");
  assert.equal(normalizeScope("a//b/**"), "a/b/*");
  assert.equal(normalizeScope("./local").replace(/^\.\//, ""), "local");
  assert.equal(readTaskLine("- [x] 26.1 описание\n", "26.1")?.checked, true);
  assert.equal(readTaskLine("- [x] 26.1 описание\n", "99.9"), null);
  assert.ok(Number.isFinite(parseHeartbeat("2026-10-20T12:00:00+03:00")));
  assert.ok(Number.isNaN(parseHeartbeat("мусор")));
  const error = new CoordinationError("SOME_FLAG", "текст");
  assert.equal(error.flag, "SOME_FLAG");
  const st = isHeartbeatStale(new StatusFile(claimBody("x", [], FRESH)), NOW);
  assert.equal(st, false);
  assert.equal(isHeartbeatStale(new StatusFile(claimBody("x", [], STALE)), NOW), true);
});

test("dispatch: --help и unknown verb", () => {
  const help = dispatch(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.output, /heartbeat <task-id>/);
  assert.match(cliUsage(), /review/);
  const unknown = dispatch(["frob", "--root", "/tmp"]);
  assert.equal(unknown.code, 2);
  assert.match(unknown.output, /CALL_frob: UNKNOWN_COMMAND/);
});

test("board печатает claims/READY/DONE-CHECKS и NO_SAFE_TASK", () => {
  const root = makeSandbox([
    ["900.1.lock", claimBody("gate-owner", ["src/gate"], STALE)],
  ]);
  dispatch(["claim", "99.1", "--session", "live", "--scope", "src/other", "--root", root, "--now", FRESH]);
  const clean = dispatch(["board", "--root", root, "--now", NOW.toISOString()]);
  assert.equal(clean.code, 0);
  assert.match(clean.output, /IN_PROGRESS 900\.1 owner=gate-owner hb_age=120m deps=- scopes=src\/gate STALE_CANDIDATE/);
  assert.match(clean.output, /IN_PROGRESS 99\.1 owner=live hb_age=10m/);
  assert.match(clean.output, /BOARD READY 100\.1/);
  assert.match(clean.output, /BOARD READY 100\.2/);
  assert.match(clean.output, /BOARD DONE-CHECKS 1\/4/);
  assert.ok(!clean.output.includes("NO_SAFE_TASK"));
  const blocked = dispatch(["board", "--scope", "src/gate/deep", "--root", root, "--now", NOW.toISOString()]);
  assert.equal(blocked.code, 0);
  assert.match(blocked.output, /NO_SAFE_TASK scope=src\/gate\/deep/);
});

test("board помечает WAITING_APPROVAL и отклоняет позиционные аргументы", () => {
  const gated = `${claimBody("gate-owner", ["src/gate"], FRESH)}- approval_gated: true\n`;
  const root = makeSandbox([["900.1.lock", gated]]);
  const clean = dispatch(["board", "--root", root, "--now", NOW.toISOString()]);
  assert.equal(clean.code, 0);
  assert.match(clean.output, /WAITING_APPROVAL 900\.1 owner=gate-owner/);
  const bad = dispatch(["board", "99.1", "--root", root]);
  assert.equal(bad.code, 2);
  assert.match(bad.output, /CALL_board: USES_FLAGS_ONLY/);
  assert.equal(boardEntries(root, NOW).length, 1);
});

test("integrate: единичный flip, перенос lock в archive, audit", () => {
  const root = makeSandbox();
  dispatch(["claim", "99.1", "--session", "author", "--scope", "a.ts", "--root", root, "--now", FRESH]);
  dispatch(["status", "99.1", "REVIEW", "--note", "готово", "--root", root, "--now", FRESH]);
  dispatch(["review", "99.1", "--verdict", "PASS", "--reviewer", "reviewer-1", "--root", root, "--now", FRESH]);
  const auditText = fs.readFileSync(path.join(root, ".agents", "coordination", "cli", "audit.log"), "utf8");
  assert.match(auditText, /review task=99\.1 reviewer=reviewer-1 verdict=PASS/);

  const self = dispatch(["integrate", "99.1", "--session", "author", "--root", root, "--now", FRESH]);
  assert.equal(self.code, 2);
  assert.match(self.output, /CALL_integrate: INTEGRATION_BY_AUTHOR/);

  const ok = dispatch(["integrate", "99.1", "--session", "integrator", "--root", root, "--now", FRESH]);
  assert.equal(ok.code, 0);
  assert.match(ok.output, /INTEGRATED 99\.1/);

  const tasksText = fs.readFileSync(path.join(root, "openspec", "changes", "impulse-ecosystem", "tasks.md"), "utf8");
  assert.equal(tasksText.split(/\r?\n/).filter((line) => line.startsWith("- [x] 99.1 ")).length, 1);
  assert.ok(!tasksText.includes("- [ ] 99.1 "));

  assert.ok(!fs.existsSync(path.join(root, ".agents", "coordination", "claims", "99.1.lock")));
  const archived = fs.readFileSync(
    path.join(root, ".agents", "coordination", "cli", "archive", "99.1.lock", "status.md"),
    "utf8",
  );
  assert.match(archived, /- status: DONE/);

  const finalAudit = fs.readFileSync(path.join(root, ".agents", "coordination", "cli", "audit.log"), "utf8");
  assert.match(finalAudit, /integrate task=99\.1 integrator=integrator author=author/);

  const second = dispatch(["integrate", "99.1", "--session", "integrator", "--root", root, "--now", NOW.toISOString()]);
  assert.equal(second.code, 2);
  assert.match(second.output, /CALL_integrate: TASK_NOT_CLAIMED/);
  const reread = fs.readFileSync(path.join(root, "openspec", "changes", "impulse-ecosystem", "tasks.md"), "utf8");
  assert.equal(reread.split(/\r?\n/).filter((line) => line.startsWith("- [x] 99.1 ")).length, 1);
});

test("integrate отказы: NOT_DONE, CHECKBOX_ALREADY_DONE, TASK_UNKNOWN", () => {
  const root = makeSandbox();
  dispatch(["claim", "100.1", "--session", "author", "--scope", "a.ts", "--root", root, "--now", FRESH]);
  const early = dispatch(["integrate", "100.1", "--session", "integrator", "--root", root]);
  assert.equal(early.code, 2);
  assert.match(early.output, /CALL_integrate: NOT_DONE/);

  dispatch(["status", "100.1", "REVIEW", "--note", "готово", "--root", root, "--now", FRESH]);
  dispatch(["review", "100.1", "--verdict", "PASS", "--reviewer", "reviewer-1", "--root", root, "--now", FRESH]);
  fs.writeFileSync(
    path.join(root, "openspec", "changes", "impulse-ecosystem", "tasks.md"),
    "- [ ] 99.1 задача песочницы\n- [x] 99.2 закрытая задача\n- [x] 100.1 соседняя принята вручную\n- [ ] 100.2 вторая\n",
    "utf8",
  );
  const already = dispatch(["integrate", "100.1", "--session", "integrator", "--root", root]);
  assert.equal(already.code, 2);
  assert.match(already.output, /CALL_integrate: CHECKBOX_ALREADY_DONE/);
  assert.ok(fs.existsSync(path.join(root, ".agents", "coordination", "claims", "100.1.lock")));

  const unknown = dispatch(["integrate", "77.7", "--session", "integrator", "--root", root]);
  assert.equal(unknown.code, 2);
  assert.match(unknown.output, /CALL_integrate: TASK_NOT_CLAIMED/);

  const orphanRoot = makeSandbox([
    ["77.7.lock", claimBody("author", ["orphan.ts"], FRESH).replace("- status: IN_PROGRESS", "- status: DONE")],
  ]);
  const orphan = dispatch(["integrate", "77.7", "--session", "integrator", "--root", orphanRoot]);
  assert.equal(orphan.code, 2);
  assert.match(orphan.output, /CALL_integrate: TASK_UNKNOWN/);
});
