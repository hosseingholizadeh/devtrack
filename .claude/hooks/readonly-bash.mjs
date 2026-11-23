// PreToolUse guard for read-only subagents: allow only a small allowlist of read-only commands.
// Usage (from agent frontmatter): node readonly-bash.mjs <profile>   where profile = git | git-audit
// Exit 2 = block (stderr is shown to the agent). Fails open on malformed input (other hooks/permissions still apply).
//
// Allowed shapes (single simple command; no shell operators, quoting, expansion or wildcards):
//   git [-C <dir inside the project>] <diff|log|show|status|ls-files> [args]
//   npm ls   [allowlisted flags | package names]     (git-audit profile)
//   npm audit [allowlisted flags]                    (git-audit profile; `npm audit fix` is rejected)
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const GIT_SUBCOMMANDS = ["diff", "log", "show", "status", "ls-files"];
const PROFILES = { git: { npm: [] }, "git-audit": { npm: ["ls", "audit"] } };

// Long options that write files, run external programs, or read outside the repo. Git accepts any
// unambiguous abbreviation of a long option (`--out=x` == `--output=x`), so prefixes are blocked too.
const BLOCKED_LONG = ["--output", "--ext-diff", "--textconv", "--no-index", "--exec-path", "--open-files-in-pager", "--show-signature"];

// npm: only these flags are accepted (npm resolves abbreviations and `-C` means --prefix, so a deny-list is unsafe).
const NPM_FLAGS = {
  audit: [/^--json$/, /^--omit=(dev|optional|peer)$/, /^--production$/, /^--audit-level=(info|low|moderate|high|critical)$/],
  ls: [/^--json$/, /^--all$/, /^--long$/, /^--depth=\d+$/, /^--omit=(dev|optional|peer)$/, /^--production$/],
};

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
  console.error(
    `Blocked: this agent is read-only (${reason}). Allowed: git ${GIT_SUBCOMMANDS.join("|")} (optionally with -C <dir in project>)` +
      (profile.npm.length ? `, npm ${profile.npm.join("|")} (allowlisted flags only)` : "") +
      ". No pipes, chaining, quotes, wildcards or redirects.",
  );
  process.exit(2);
}

const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};

function insideProject(dir) {
  // Windows: accept Git Bash style /c/path. Elsewhere a drive-letter path is never "inside the
  // project" (POSIX would otherwise treat `C:/x` as a relative directory name).
  const win = process.platform === "win32";
  if (!win && /^[A-Za-z]:/.test(dir)) return false;
  const p = win ? dir.replace(/^\/([a-zA-Z])\/(.*)$/, "$1:/$2") : dir;
  const rootReal = real(root);
  const abs = real(resolve(input.cwd || root, p)); // realpath: symlinks/junctions leaving the project are rejected
  const rel = relative(rootReal, abs);
  if (!(rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)))) return false;
  // A nested repository has its own (untrusted) .git/config, which can run programs (fsmonitor, pager, ...).
  for (let d = abs; relative(rootReal, d) !== "" && d !== dirname(d); d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return false; // `relative` is case-insensitive on Windows
  }
  return true;
}

if (!cmd) deny("empty command");
if (/[;&|<>`$"'\\(){}\n\r*?[\]]/.test(cmd)) deny("shell operators, quoting, expansion or wildcards");

const tokens = cmd.split(/\s+/);
if (tokens.some((t) => t.startsWith("~"))) deny("home-directory expansion");

const longOptionBlocked = (args) =>
  args.some((a) => {
    if (a.startsWith("-O")) return true; // orderfile: reads an arbitrary file
    if (!a.startsWith("--") || a === "--") return false;
    const name = a.split("=")[0];
    return name.length > 2 && BLOCKED_LONG.some((b) => b.startsWith(name));
  });

if (tokens[0] === "git") {
  let i = 1;
  if (tokens[i] === "-C") {
    const dir = tokens[i + 1];
    if (!dir || !insideProject(dir)) deny("git -C must point inside the project (no symlinks out, no nested repositories)");
    i += 2;
  }
  const sub = tokens[i];
  if (!GIT_SUBCOMMANDS.includes(sub)) deny(`git ${sub ?? ""} is not allowed`);
  const args = tokens.slice(i + 1);
  // Stop at `--`: everything after is a pathspec, not an option.
  const opts = args.slice(0, args.includes("--") ? args.indexOf("--") : undefined);
  if (longOptionBlocked(opts)) deny("option can write files, run programs or read outside the repo");
} else if (tokens[0] === "npm" && profile.npm.includes(tokens[1])) {
  const sub = tokens[1];
  for (const a of tokens.slice(2)) {
    if (a.startsWith("-")) {
      if (!NPM_FLAGS[sub].some((re) => re.test(a))) deny(`npm ${sub} flag "${a}" is not allowlisted`);
    } else if (sub === "audit") {
      deny("npm audit takes flags only (no `fix`)");
    } else if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(a)) {
      deny("npm ls accepts package names only");
    }
  }
} else {
  deny(`"${tokens.slice(0, 2).join(" ")}" is not allowed`);
}
