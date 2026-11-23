// PostToolUse (Edit|Write): lint ONLY the edited file (cheap).
// ESLint exit codes: 0 = clean, 1 = lint errors, 2 = fatal/config error. Anything non-zero
// (including a timeout or failure to start) is fed back to Claude (exit 2) with an accurate message.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const file = input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
if (!file || !/\.([cm]?[jt]sx?)$/.test(file)) process.exit(0);

const abs = resolve(root, file);
const eslint = join(root, "node_modules", "eslint", "bin", "eslint.js");
if (!existsSync(abs) || !existsSync(eslint)) process.exit(0); // deleted file, or deps not installed

const r = spawnSync(process.execPath, [eslint, "--no-warn-ignored", abs], {
  cwd: root,
  encoding: "utf8",
  timeout: Number(process.env.DEVTRACK_HOOK_TIMEOUT_MS) || 60_000,
});

if (r.status === 0) process.exit(0);

const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
if (r.status === 1) {
  console.error(`ESLint found problems in ${file}:\n${out}`);
} else if (r.error || r.status === null) {
  console.error(`ESLint could not finish on ${file} (${r.error?.code ?? r.signal ?? "timeout"}). Run \`npm run lint\` manually.`);
} else {
  console.error(`ESLint failed to run (exit ${r.status}); this is a configuration or fatal error, not a lint finding:\n${out}`);
}
process.exit(2);
