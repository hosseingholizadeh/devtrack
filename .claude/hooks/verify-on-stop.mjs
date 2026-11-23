// Stop hook (WARN ONLY): when source files changed since the last passing check, run typecheck + lint
// and surface a warning to the user. Never blocks the turn (always exits 0, no "decision").
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 120_000 });
const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout ?? "";

// Fingerprint of the working-tree source changes; skip if unchanged since last passing run.
const SRC = /\.(m?[jt]sx?|css|json)$/;
const changed = git(["status", "--porcelain"]).split("\n").filter((l) => SRC.test(l.trim()));
if (changed.length === 0) process.exit(0);
const fingerprint = createHash("sha1")
  .update(git(["diff", "HEAD"]) + changed.join("\n"))
  .digest("hex");
const stamp = join(tmpdir(), `devtrack-verified-${createHash("sha1").update(root).digest("hex").slice(0, 8)}`);
if (existsSync(stamp) && readFileSync(stamp, "utf8") === fingerprint) process.exit(0);

const bin = (p) => join(root, "node_modules", ...p);
if (!existsSync(bin(["typescript", "bin", "tsc"]))) process.exit(0); // deps not installed

const problems = [];
const typegen = run([bin(["next", "dist", "bin", "next"]), "typegen"]);
const tsc = run([bin(["typescript", "bin", "tsc"]), "--noEmit"]);
if (typegen.status !== 0 || tsc.status !== 0) {
  problems.push("typecheck failed:\n" + (tsc.stdout || tsc.stderr || typegen.stderr).trim().split("\n").slice(0, 8).join("\n"));
}
const lint = run([bin(["eslint", "bin", "eslint.js"])]);
if (lint.status !== 0) {
  problems.push("lint failed:\n" + (lint.stdout || lint.stderr).trim().split("\n").slice(0, 8).join("\n"));
}

if (problems.length === 0) {
  writeFileSync(stamp, fingerprint);
  process.exit(0);
}
console.log(
  JSON.stringify({
    systemMessage: `⚠ Verification warning (not blocking):\n${problems.join("\n\n")}\nRun /verify for the full report.`,
  }),
);
