// PostToolUse (Edit|Write): lint ONLY the edited file (cheap). Lint errors are fed back to Claude (exit 2).
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
if (!file || !/\.(m?[jt]sx?|cjs)$/.test(file)) process.exit(0);

const abs = resolve(root, file);
const eslint = join(root, "node_modules", "eslint", "bin", "eslint.js");
if (!existsSync(abs) || !existsSync(eslint)) process.exit(0); // deps not installed or file deleted

const r = spawnSync(process.execPath, [eslint, "--no-warn-ignored", abs], {
  cwd: root,
  encoding: "utf8",
  timeout: 60_000,
});

if (r.status === 1) {
  console.error(`ESLint found problems in ${file}:\n${(r.stdout || r.stderr).trim()}`);
  process.exit(2);
}
