// PreToolUse guard for read-only subagents: allow only a small allowlist of read-only commands.
// Usage (from agent frontmatter): node readonly-bash.mjs <profile>   where profile = git | git-audit
// Exit 2 = block (stderr is shown to the agent). Fails open on malformed input (other hooks/permissions still apply).
//
// Allowed shapes (single simple command, no shell operators or quoting):
//   git [-C <dir inside the project>] <diff|log|show|status|ls-files> [args]
//   npm ls [args]                    (git-audit profile)
//   npm audit [--flags only]         (git-audit profile; `npm audit fix` and positionals are rejected)
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const GIT_SUBCOMMANDS = ["diff", "log", "show", "status", "ls-files"];
const PROFILES = { git: { npm: [] }, "git-audit": { npm: ["ls", "audit"] } };

// Long options that write files, run external programs, or read outside the repo. Git accepts any
// unambiguous abbreviation of a long option (`--out=x` == `--output=x`), so prefixes are blocked too.
const BLOCKED_LONG = ["--output", "--ext-diff", "--textconv", "--no-index", "--exec-path", "--open-files-in-pager"];

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const profile = PROFILES[process.argv[2]] ?? PROFILES.git;
const cmd = String(input.tool_input?.command ?? "").trim();
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

function deny(reason) {
  console.error(`Blocked: this agent is read-only (${reason}). Allowed: git ${GIT_SUBCOMMANDS.join("|")} (optionally with -C <dir in project>)` +
    (profile.npm.length ? `, npm ${profile.npm.join("|")} (flags only)` : "") + ". No pipes, chaining, quotes or redirects.");
  process.exit(2);
}

function insideProject(dir) {
  // Accept Git Bash style /c/path on Windows.
  const p = dir.replace(/^\/([a-zA-Z])\/(.*)$/, "$1:/$2");
  const abs = resolve(input.cwd || root, p);
  const rel = relative(resolve(root), abs);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

if (!cmd) deny("empty command");
if (/[;&|<>`$"'\\(){}\n\r]/.test(cmd)) deny("shell operators, quoting or expansion");

const tokens = cmd.split(/\s+/);
const longOptionBlocked = (args) =>
  args.some((a) => {
    if (!a.startsWith("--") || a === "--") return false;
    const name = a.split("=")[0];
    return name.length > 2 && BLOCKED_LONG.some((b) => b.startsWith(name));
  });

if (tokens[0] === "git") {
  let i = 1;
  if (tokens[i] === "-C") {
    const dir = tokens[i + 1];
    if (!dir || !insideProject(dir)) deny("git -C must point inside the project");
    i += 2;
  }
  const sub = tokens[i];
  if (!GIT_SUBCOMMANDS.includes(sub)) deny(`git ${sub ?? ""} is not allowed`);
  const args = tokens.slice(i + 1);
  // Stop at `--`: everything after is a pathspec, not an option.
  const opts = args.slice(0, args.includes("--") ? args.indexOf("--") : undefined);
  if (longOptionBlocked(opts)) deny("option can write files, run programs or read outside the repo");
} else if (tokens[0] === "npm" && profile.npm.includes(tokens[1])) {
  const args = tokens.slice(2);
  if (tokens[1] === "audit" && args.some((a) => !a.startsWith("-"))) deny("npm audit takes flags only (no `fix`)");
  if (args.some((a) => a === "--prefix" || a.startsWith("--prefix=") || a === "--userconfig")) deny("option not allowed");
} else {
  deny(`"${tokens.slice(0, 2).join(" ")}" is not allowed`);
}
