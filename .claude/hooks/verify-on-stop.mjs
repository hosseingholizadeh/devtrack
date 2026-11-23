// Stop hook (WARN ONLY): if source files differ from HEAD, run typegen + tsc + eslint and show a warning.
// Never blocks the turn (always exits 0, no "decision"). A result stamp skips re-running when
// nothing changed since the last passing run.
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const BUDGET_MS = Number(process.env.DEVTRACK_HOOK_TIMEOUT_MS) || 150_000; // total; settings.json hook timeout is 180s
const deadline = Date.now() + BUDGET_MS;

const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout ?? "";

// Changed or untracked source files. -uall lists files inside new directories; -z is path-safe.
const SRC = /\.([cm]?[jt]sx?|css|json)$/;
const files = git(["status", "--porcelain", "-uall", "-z"])
  .split("\0")
  .filter(Boolean)
  .map((l) => l.slice(3))
  .filter((p) => SRC.test(p))
  .sort();
if (files.length === 0) process.exit(0);

// Fingerprint = path + size + mtime of every changed file (covers untracked files and edits alike).
const hash = createHash("sha1");
for (const f of files) {
  try {
    const s = statSync(join(root, f));
    hash.update(`${f}:${s.size}:${s.mtimeMs}\n`);
  } catch {
    hash.update(`${f}:deleted\n`);
  }
}
const fingerprint = hash.digest("hex");
const stamp = join(tmpdir(), `devtrack-verified-${createHash("sha1").update(root).digest("hex").slice(0, 8)}`);
try {
  if (existsSync(stamp) && readFileSync(stamp, "utf8") === fingerprint) process.exit(0);
} catch {}

const bin = (...p) => join(root, "node_modules", ...p);
if (!existsSync(bin("typescript", "bin", "tsc"))) process.exit(0); // deps not installed

// Each step gets whatever is left of the shared budget, so the hook can never outlive its timeout.
function step(label, args) {
  const left = deadline - Date.now();
  if (left <= 0) return `${label}: skipped (time budget used up)`;
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: left });
  if (r.status === 0) return null;
  if (r.status === null) return `${label}: timed out or could not start (${r.error?.code ?? r.signal ?? "timeout"})`;
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(0, 8).join("\n");
  return `${label} failed:\n${out}`;
}

const problems = [
  step("typegen", [bin("next", "dist", "bin", "next"), "typegen"]),
  step("typecheck", [bin("typescript", "bin", "tsc"), "--noEmit"]),
  step("lint", [bin("eslint", "bin", "eslint.js")]),
].filter(Boolean);

if (problems.length === 0) {
  try {
    writeFileSync(stamp, fingerprint);
  } catch {}
  process.exit(0);
}
console.log(
  JSON.stringify({
    systemMessage: `⚠ Verification warning (not blocking):\n${problems.join("\n\n")}\nRun /verify for the full report.`,
  }),
);
