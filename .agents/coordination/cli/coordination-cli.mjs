#!/usr/bin/env node
// Описание протокола: openspec/changes/impulse-ecosystem/docs/parallel-agent-workflow.md
// CLI verbs: claim | status | heartbeat | review | release | check

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");
const STATUSES = ["IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];
const RELEASED = "RELEASED";
const ACTIVE_STATUSES = new Set(["IN_PROGRESS", "BLOCKED", "REVIEW"]);
const VERDICTS = new Set(["PASS", "CHANGES_REQUIRED"]);
const STALE_THRESHOLD_MS = 90 * 60 * 1000;

export function cliUsage() {
  return [
    "coordination-cli — атомарный claim protocol (docs/parallel-agent-workflow.md)",
    "",
    "Commands:",
    "  claim <task-id> --session <id> --scope <path> [--scope more] [--depends 22.1,22.2]",
    "        [--note ...] [--base-revision <sha>] [--root <dir>]",
    "  status <task-id> <IN_PROGRESS|BLOCKED|REVIEW> --note <text> [--session <id>] [--root <dir>]",
    "  heartbeat <task-id> [--session <id>] [--now <iso>] [--root <dir>]",
    "  review <task-id> --verdict <PASS|CHANGES_REQUIRED> --reviewer <session-id> [--note ...]",
    "        [--root <dir>]",
    "  release <task-id> --session <id> --reason <text> [--root <dir>]",
    "  check <task-id> [--scope <path>...] [--now <iso>] [--root <dir>]",
    "  board [--scope <path>] [--now <iso>] [--root <dir>]  — read-only сводка claims + READY + NO_SAFE_TASK",
    "  integrate <task-id> --session <integrator-id> [--now <iso>] [--root <dir>]",
    "        — единичный flip checkbox (только после review PASS, не автором) + перенос lock в archive/ + audit.log",
    "",
    "Ошибки: код выхода 2 + строка `CALL_<verb>: <FLAG> ...`.",
  ].join("\n");
}

export class CoordinationError extends Error {
  constructor(flag, message) {
    super(message);
    this.flag = flag;
  }
}

export function parseArgs(argv) {
  const positional = [];
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const name = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        const values = flags.get(name) ?? [];
        values.push(next);
        flags.set(name, values);
        i += 1;
      } else {
        const values = flags.get(name) ?? [];
        values.push("true");
        flags.set(name, values);
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

export function normalizeScope(raw) {
  let clean = raw.trim().replaceAll("\\", "/").replace(/\*\*+/g, "*");
  while (clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  const segments = clean.split("/").filter((segment) => segment && segment !== ".");
  return segments.join("/");
}

function flagValue(flags, name) {
  const values = flags.get(name) ?? [];
  return values[0];
}

function requiredValue(flags, name) {
  const value = flagValue(flags, name);
  if (value === undefined || value === "" || value === "true") {
    throw new CoordinationError("MISSING_FLAG", `required flag --${name}`);
  }
  return value;
}

function requirePositional(positional, count) {
  if (positional.length < count) {
    throw new CoordinationError("MISSING_ARG", `требуется ${count} позиционных аргументов`);
  }
  return positional;
}

export function statusTimestamp(now = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offset = now.getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const hoursOffset = pad(Math.floor(abs / 60));
  const minutesOffset = pad(abs % 60);
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${hoursOffset}:${minutesOffset}`
  );
}

export function parseHeartbeat(raw) {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):?(\d{2})?$/);
  if (!match) return NaN;
  const [, y, m, d, hh, mm, ss, sign, offH, offM] = match;
  const offsetMinutes = (Number(offH) * 60 + Number(offM ?? 0)) * (sign === "-" ? -1 : 1);
  const utc = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  return utc - offsetMinutes * 60_000;
}

export class StatusFile {
  constructor(text) {
    this.text = text;
  }

  field(name) {
    const match = this.text.match(new RegExp(`^\\-\\s*${name}:\\s*(.*)$`, "m"));
    return match ? match[1].trim() : null;
  }

  setField(name, value) {
    const line = `- ${name}: ${value}`;
    const pattern = new RegExp(`^\\-\\s*${name}:[^\\n]*$`, "m");
    if (pattern.test(this.text)) {
      this.text = this.text.replace(pattern, line);
    } else {
      this.text += `\n${line}\n`;
    }
  }

  scopes() {
    const normalized = [];
    const lines = this.text.split(/\r?\n/);
    let inside = false;
    for (const line of lines) {
      if (/^-\s*write_scope:/.test(line)) {
        inside = true;
        continue;
      }
      if (!inside) continue;
      if (!line.trim()) continue;
      if (!line.startsWith("  ")) break;
      const trimmed = line.trim();
      if (!/^-\s/.test(trimmed)) break;
      normalized.push(normalizeScope(trimmed.replace(/^-\s*/, "")));
    }
    return normalized;
  }

  setStatus(value) {
    this.setField("status", value);
  }

  appendProgress(line) {
    this.text = `${this.text.replace(/\s*$/, "")}\n- ${line}`;
  }
}

export function readTaskLine(tasksText, taskId) {
  const pattern = new RegExp(`^\\-\\s*\\[( |x)\\]\\s*${taskId.replaceAll(".", "\\.")}\\b`, "m");
  const match = tasksText.match(pattern);
  if (!match) return null;
  return { checked: match[1].toLowerCase() === "x" };
}

export function isHeartbeatStale(state, now) {
  const heartbeat = state.field("heartbeat_at");
  if (!heartbeat) return true;
  const parsed = parseHeartbeat(heartbeat);
  if (Number.isNaN(parsed)) return true;
  return now.getTime() - parsed > STALE_THRESHOLD_MS;
}

function claimsDir(root) {
  return path.join(root, ".agents", "coordination", "claims");
}

export function statusFilePath(root, taskId) {
  return path.join(claimsDir(root), `${taskId}.lock`, "status.md");
}

function tasksFilePath(root) {
  return path.join(root, "openspec", "changes", "impulse-ecosystem", "tasks.md");
}

function requireStatusFile(root, taskId) {
  const file = statusFilePath(root, taskId);
  if (!fs.existsSync(file)) {
    throw new CoordinationError("TASK_NOT_CLAIMED", `${taskId}:  lock отсутствует (${file})`);
  }
  return new StatusFile(fs.readFileSync(file, "utf8"));
}

function dateFromFlag(flags, name) {
  const raw = flagValue(flags, name);
  return raw ? new Date(raw) : new Date();
}

function scopeConflicts(root, taskId, incoming, now) {
  const conflicts = [];
  const dir = claimsDir(root);
  if (!fs.existsSync(dir)) return conflicts;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".lock") || name === `${taskId}.lock`) continue;
    const file = path.join(dir, name, "status.md");
    if (!fs.existsSync(file)) continue;
    const state = new StatusFile(fs.readFileSync(file, "utf8"));
    const status = (state.field("status") ?? "").toUpperCase();
    if (!ACTIVE_STATUSES.has(status)) continue;
    const owner = state.field("session_id") ?? "?";
    const stale = isHeartbeatStale(state, now);
    for (const candidate of incoming) {
      for (const existing of state.scopes()) {
        if (scopeConflict(candidate, existing)) {
          conflicts.push(
            `${name.replace(".lock", "")} (${owner}, ${status}${stale ? ", STALE_CANDIDATE" : ""}): пересечение на ${existing}`,
          );
        }
      }
    }
  }
  return conflicts;
}

function scopeConflict(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function gitRevision(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function ensureTaskClaimable(root, taskId) {
  const file = tasksFilePath(root);
  if (!fs.existsSync(file)) {
    throw new CoordinationError("TASKS_MISSING", "tasks.md не найден");
  }
  const tasks = fs.readFileSync(file, "utf8");
  const task = readTaskLine(tasks, taskId);
  if (!task) throw new CoordinationError("TASK_UNKNOWN", `${taskId}: нет в tasks.md`);
  if (task.checked) throw new CoordinationError("TASK_DONE", `${taskId}: уже принят в tasks.md`);
}

function writeStatusFile(root, taskId, state) {
  fs.writeFileSync(statusFilePath(root, taskId), `${state.text.trimEnd()}\n`, "utf8");
}

function auditFilePath(root) {
  return path.join(root, ".agents", "coordination", "cli", "audit.log");
}

function archiveLockDir(root, taskId) {
  return path.join(root, ".agents", "coordination", "cli", "archive", `${taskId}.lock`);
}

function auditAppend(root, line) {
  const file = auditFilePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${line}\n`, "utf8");
}

function flipCheckedCheckbox(tasksText, taskId) {
  const pattern = new RegExp(`^(\\s*)- \\[ \\] ${taskId.replaceAll(".", "\\.")}\\b`, "m");
  if (!pattern.test(tasksText)) {
    throw new CoordinationError("CHECKBOX_FLIP_FAILED", `${taskId}: непринятый пункт не найден в tasks.md`);
  }
  return tasksText.replace(pattern, (line) => line.replace("[ ]", "[x]"));
}

function taskTemplate(taskId, session, revision, scopes, depends, note, stamp) {
  return [
    `# Claim ${taskId}`,
    "",
    `- session_id: ${session}`,
    "- status: IN_PROGRESS",
    `- started_at: ${stamp}`,
    `- heartbeat_at: ${stamp}`,
    `- base_revision: ${revision}`,
    "- depends_on:",
    ...depends.map((item) => `  - ${item}`),
    "- write_scope:",
    ...scopes.map((item) => `  - ${item}`),
    "- shared_files: []",
    "- lane: auto-claimed",
    "- approval_gated: false",
    "- blockers: none",
    ...(note ? ["", "## Progress", "", `- claim: ${note}`] : []),
    "",
  ].join("\n");
}

export function runClaim(argv) {
  const { positional, flags } = parseArgs(argv);
  const [taskId] = requirePositional(positional, 1);
  const root = path.resolve(flagValue(flags, "root") ?? DEFAULT_ROOT);
  const session = requiredValue(flags, "session");
  const scopes = (flags.get("scope") ?? []).filter((value) => value !== "true");
  if (!scopes.length) throw new CoordinationError("MISSING_FLAG", "required flag --scope");
  ensureTaskClaimable(root, taskId);

  const now = dateFromFlag(flags, "now");
  const normalized = scopes.map(normalizeScope);
  const conflicts = scopeConflicts(root, taskId, normalized, now);
  if (conflicts.length) {
    throw new CoordinationError(
      "SCOPE_CONFLICT",
      `${taskId}: write-scope пересекается с активными claims: ${conflicts.join("; ")}`,
    );
  }

  const dir = path.join(claimsDir(root), `${taskId}.lock`);
  ensureReleasedLockRemoved(root, taskId, dir);
  try {
    fs.mkdirSync(dir, { recursive: false });
  } catch (error) {
    if ((error)?.code === "EEXIST") {
      throw new CoordinationError("TASK_ALREADY_CLAIMED", `${taskId}: lock уже существует`);
    }
    throw error;
  }

  const depends = (flagValue(flags, "depends") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const note = flags.get("note")?.[0];
  const revision = flagValue(flags, "base-revision") ?? gitRevision(root);
  const stamp = statusTimestamp(now);
  fs.writeFileSync(path.join(dir, "status.md"), taskTemplate(taskId, session, revision, normalized, depends, note, stamp), "utf8");
  process.stdout.write(`CLAIMED ${taskId} (${session})\n`);
}

function assertAuthorized(state, taskId, session) {
  if (!session) return;
  const owner = state.field("session_id");
  if (owner && owner !== session) {
    throw new CoordinationError("SESSION_MISMATCH", `${taskId}: claim владеет ${owner}`);
  }
}

export function runStatus(argv) {
  const { positional, flags } = parseArgs(argv);
  const [taskId, requested] = requirePositional(positional, 2);
  const root = resolveRoot(flags, "root");
  const status = requested.toUpperCase();
  if (status === RELEASED) {
    throw new CoordinationError("STATUS_FORBIDDEN", "для RELEASED используйте verb `release`");
  }
  if (!["IN_PROGRESS", "BLOCKED", "REVIEW"].includes(status)) {
    throw new CoordinationError("STATUS_INVALID", `статус через \`status\`: ${requested}; DONE ставится только через review`);
  }

  const state = requireStatusFile(root, taskId);
  assertAuthorized(state, taskId, flagValue(flags, "session"));
  const note = flagValue(flags, "note");
  if ((status === "REVIEW" || status === "BLOCKED") && !note) {
    throw new CoordinationError("NOTE_REQUIRED", `${status} требует --note`);
  }
  state.setStatus(status);
  if (note) state.appendProgress(`${status}: ${note}`);
  writeStatusFile(root, taskId, state);
  process.stdout.write(`STATUS ${taskId} -> ${status}\n`);
}

function resolveRoot(flags, name = "root") {
  return path.resolve(flagValue(flags, name) ?? DEFAULT_ROOT);
}

export function runHeartbeat(argv) {
  const { positional, flags } = parseArgs(argv);
  const [taskId] = requirePositional(positional, 1);
  const root = resolveRoot(flags);
  const state = requireStatusFile(root, taskId);
  assertAuthorized(state, taskId, flagValue(flags, "session"));
  const now = flags.get("now")?.[0] ? new Date(flags.get("now")[0]) : new Date();
  state.setField("heartbeat_at", statusTimestamp(now));
  writeStatusFile(root, taskId, state);
  process.stdout.write(`HEARTBEAT ${taskId}\n`);
}

export function runReview(argv) {
  const { positional, flags } = parseArgs(argv);
  const [taskId] = requirePositional(positional, 1);
  const root = resolveRoot(flags);
  const verdict = (flagValue(flags, "verdict") ?? "").toUpperCase();
  if (!VERDICTS.has(verdict)) {
    throw new CoordinationError("VERDICT_INVALID", "--verdict PASS|CHANGES_REQUIRED");
  }
  const reviewer = requiredValue(flags, "reviewer");
  const note = flagValue(flags, "note");
  const state = requireStatusFile(root, taskId);
  const author = state.field("session_id");
  if (reviewer === author) {
    throw new CoordinationError("SELF_REVIEW", "reviewer совпадает с author session");
  }
  if (verdict === "CHANGES_REQUIRED" && !note) {
    throw new CoordinationError("NOTE_REQUIRED", "CHANGES_REQUIRED требует --note");
  }
  const currentStatus = (state.field("status") ?? "").toUpperCase();
  if (currentStatus !== "REVIEW") {
    throw new CoordinationError("NOT_IN_REVIEW", `${taskId}: текущий статус ${currentStatus}; автор ставит REVIEW`);
  }
  if (currentStatus === "REVIEW" && isHeartbeatStale(state, dateFromFlag(flags, "now"))) {
    throw new CoordinationError(
      "STALE_HEARTBEAT",
      `${taskId}: heartbeat просрочен; review требует свежего heartbeat автора`,
    );
  }
  const stamp = statusTimestamp(dateFromFlag(flags, "now"));
  state.appendProgress(`review: verdict=${verdict} reviewer=${reviewer}${note ? `; ${note}` : ""}`);
  state.appendProgress(`reviewed_at: ${stamp}`);
  if (verdict === "PASS") {
    state.setStatus("DONE");
    state.appendProgress("checkbox flip выполняет reviewer flow отдельным шагом (26.4)");
  } else {
    state.setStatus("BLOCKED");
  }
  writeStatusFile(root, taskId, state);
  auditAppend(root, `review task=${taskId} reviewer=${reviewer} verdict=${verdict}`);
  process.stdout.write(`REVIEW ${taskId} -> ${verdict === "PASS" ? "DONE" : "BLOCKED"}\n`);
}

export function runIntegrate(argv) {
  const { positional, flags } = parseArgs(argv);
  const [taskId] = requirePositional(positional, 1);
  const root = resolveRoot(flags);
  const actor = requiredValue(flags, "session");
  const now = dateFromFlag(flags, "now");
  const state = requireStatusFile(root, taskId);
  const author = state.field("session_id");
  if (author && author === actor) {
    throw new CoordinationError(
      "INTEGRATION_BY_AUTHOR",
      `${taskId}: feature-агент не может самостоятельно закрыть пункт (самозакрытие запрещено)`,
    );
  }
  const currentStatus = (state.field("status") ?? "").toUpperCase();
  if (currentStatus !== "DONE") {
    throw new CoordinationError("NOT_DONE", `${taskId}: статус ${currentStatus}; интеграция возможна после review PASS`);
  }
  const tasksFile = tasksFilePath(root);
  if (!fs.existsSync(tasksFile)) {
    throw new CoordinationError("TASKS_MISSING", "tasks.md не найден");
  }
  const tasksText = fs.readFileSync(tasksFile, "utf8");
  const task = readTaskLine(tasksText, taskId);
  if (!task) throw new CoordinationError("TASK_UNKNOWN", `${taskId}: нет в tasks.md`);
  if (task.checked) {
    throw new CoordinationError("CHECKBOX_ALREADY_DONE", `${taskId}: checkbox уже [x]; единичный flip не повторяется`);
  }
  if (fs.readFileSync(tasksFile, "utf8") !== tasksText) {
    throw new CoordinationError("FILE_CHANGED", `${taskId}: tasks.md изменился во время интеграции; перезапустите`);
  }
  fs.writeFileSync(tasksFile, flipCheckedCheckbox(tasksText, taskId), "utf8");
  auditAppend(root, `integrate task=${taskId} integrator=${actor} author=${author ?? "-"}`);
  fs.mkdirSync(path.dirname(archiveLockDir(root, taskId)), { recursive: true });
  fs.renameSync(path.join(claimsDir(root), `${taskId}.lock`), archiveLockDir(root, taskId));
  process.stdout.write(`INTEGRATED ${taskId} (checkbox -> [x]; lock -> .agents/coordination/cli/archive/${taskId}.lock)\n`);
}

export function ensureReleasedLockRemoved(root, taskId, dir) {
  const file = path.join(dir, "status.md");
  if (!fs.existsSync(dir) || !fs.existsSync(file)) return;
  try {
    const state = new StatusFile(fs.readFileSync(file, "utf8"));
    if (state.field("status") !== RELEASED) return;
  } catch {
    return;
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

function runRelease(argv) {
  const { positional, flags } = parseArgs(argv);
  const [taskId] = requirePositional(positional, 1);
  const root = resolveRoot(flags);
  const session = requiredValue(flags, "session");
  const reason = requiredValue(flags, "reason");
  const state = requireStatusFile(root, taskId);
  assertAuthorized(state, taskId, session);
  state.setStatus(RELEASED);
  state.appendProgress(`release: ${reason}`);
  writeStatusFile(root, taskId, state);
  fs.rmSync(path.join(claimsDir(root), `${taskId}.lock`), { recursive: true, force: true });
  process.stdout.write(`RELEASED ${taskId}\n`);
}

export function runCheck(argv) {
  const { positional, flags } = parseArgs(argv);
  const [taskId] = requirePositional(positional, 1);
  const root = resolveRoot(flags);
  const state = requireStatusFile(root, taskId);
  const now = dateFromFlag(flags, "now");
  const incoming = (flags.get("scope") ?? [])
    .filter((value) => value !== "true")
    .map(normalizeScope);
  const scopes = incoming.length ? incoming : state.scopes();
  const conflicts = scopeConflicts(root, taskId, scopes, now);
  const stale = isHeartbeatStale(state, now);
  for (const conflict of conflicts) process.stdout.write(`CONFLICT ${conflict}\n`);
  if (stale) process.stdout.write(`HEARTBEAT_AGE ${taskId} STALE_CANDIDATE\n`);
  if (conflicts.length || stale) {
    process.exitCode = 1;
    process.stdout.write(`CHECK ${taskId} BLOCKED\n`);
  } else {
    process.stdout.write(`CHECK ${taskId} ok\n`);
  }
}

function requireBoardEntries(root, now) {
  const dir = claimsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".lock"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name, "status.md");
      if (!fs.existsSync(file)) return null;
      const state = new StatusFile(fs.readFileSync(file, "utf8"));
      const status = (state.field("status") ?? "?").toUpperCase();
      const active = ACTIVE_STATUSES.has(status);
      const approvalGated = (state.field("approval_gated") ?? "").toLowerCase() === "true";
      const heartbeat = state.field("heartbeat_at");
      const ageMs = heartbeat && !Number.isNaN(parseHeartbeat(heartbeat)) ? now.getTime() - parseHeartbeat(heartbeat) : null;
      return {
        taskId: name.replace(".lock", ""),
        sessionId: state.field("session_id"),
        status: approvalGated ? "WAITING_APPROVAL" : status,
        heartbeat,
        heartbeatAgeMs: ageMs,
        scopes: state.scopes(),
        depends: parseDepends(state),
        active,
        stale: active && isHeartbeatStale(state, now),
      };
    })
    .filter(Boolean);
}

function parseDepends(state) {
  const lines = state.text.split(/\r?\n/);
  const items = [];
  let inside = false;
  for (const line of lines) {
    if (/^-\s*depends_on:/.test(line)) {
      inside = true;
      continue;
    }
    if (!inside) continue;
    if (!line.trim()) continue;
    if (!line.startsWith("  ")) break;
    const trimmed = line.trim();
    if (!/^-\s/.test(trimmed)) break;
    items.push(trimmed.replace(/^-\s*/, "").trim());
  }
  return items;
}

function readTasksBoard(tasksText) {
  const entries = [];
  const pattern = /^-\s*\[( |x)\]\s*(\d+(?:\.\d+)*)\s*(.*)$/;
  for (const match of tasksText.matchAll(new RegExp(pattern, "gm"))) {
    entries.push({ checked: match[1].toLowerCase() === "x", taskId: match[2], note: match[3].trim() });
  }
  return entries;
}

function formatHours(ms) {
  if (ms === null || ms === undefined) return "-";
  return `${Math.max(0, Math.round(ms / 60000))}m`;
}

function runBoardImpl(root, flags, now) {
  const file = tasksFilePath(root);
  if (!fs.existsSync(file)) throw new CoordinationError("TASKS_MISSING", "tasks.md не найден");
  const tasks = readTasksBoard(fs.readFileSync(file, "utf8"));
  const entries = requireBoardEntries(root, now);
  const claimedIds = new Set(entries.map((entry) => entry.taskId));
  const unreached = tasks.filter((task) => !task.checked && !claimedIds.has(task.taskId));
  const scope = (flags.get("scope") ?? [])
    .filter((value) => value !== "true")
    .map(normalizeScope);
  process.stdout.write(`BOARD ${root} now=${statusTimestamp(now)}\n`);
  for (const entry of entries) {
    const marker = entry.stale ? " STALE_CANDIDATE" : "";
    process.stdout.write(
      `BOARD ${entry.status} ${entry.taskId} owner=${entry.sessionId ?? "-"} ` +
        `hb_age=${formatHours(entry.heartbeatAgeMs)} deps=${entry.depends.join(",") || "-"} ` +
        `scopes=${entry.scopes.join(",") || "-"}${marker}\n`,
    );
  }
  const safe = scope.length
    ? unreached.filter((task) => scopeConflicts(root, task.taskId, scope, now).length === 0)
    : unreached;
  for (const task of safe) {
    process.stdout.write(`BOARD READY ${task.taskId} deps=- (без claim: ${task.note.slice(0, 72)})\n`);
  }
  const checkedCount = tasks.filter((task) => task.checked).length;
  process.stdout.write(`BOARD DONE-CHECKS ${checkedCount}/${tasks.length} в tasks.md\n`);
  if (scope.length && !safe.length) {
    process.stdout.write(`NO_SAFE_TASK scope=${scope.join(",")}: нет незанятых пунктов без конфликта с активными claims\n`);
  }
}

export function runBoard(argv) {
  const { positional, flags } = parseArgs(argv);
  if (positional.length) {
    throw new CoordinationError("USES_FLAGS_ONLY", "board: позиционные аргументы не нужны");
  }
  const root = resolveRoot(flags);
  const now = dateFromFlag(flags, "now");
  runBoardImpl(root, flags, now);
}

export function boardEntries(root, now = new Date()) {
  return requireBoardEntries(root, now);
}

export const COMMANDS = { claim: runClaim, status: runStatus, heartbeat: runHeartbeat, review: runReview, release: runRelease, check: runCheck, board: runBoard, integrate: runIntegrate };

export function dispatch(argv) {
  const [verb, ...rest] = argv;
  if (!verb || verb === "--help" || verb === "-h") {
    return { code: 0, output: cliUsage() };
  }
  const handler = COMMANDS[verb];
  if (!handler) {
    return { code: 2, output: `CALL_${verb}: UNKNOWN_COMMAND` };
  }
  const chunks = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };
  const savedExit = process.exitCode;
  process.exitCode = undefined;
  let code = 0;
  let failure = null;
  try {
    handler(rest);
    code = process.exitCode ?? 0;
  } catch (error) {
    const flag = error instanceof CoordinationError ? error.flag : ((error)?.code ?? "ERROR");
    const message = error instanceof Error ? error.message : String(error).replace(/^CALL_[A-Z_]+:\s*/, "");
    failure = `CALL_${verb}: ${flag} — ${message}`;
    code = 2;
  } finally {
    process.stdout.write = originalWrite;
    process.exitCode = savedExit;
  }
  return { code, output: failure ?? chunks.join("") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = dispatch(process.argv.slice(2));
  const target = result.code === 2 ? process.stderr : process.stdout;
  if (result.output) target.write(`${result.output.replace(/\n+$/, "")}\n`);
  process.exit(result.code);
}
