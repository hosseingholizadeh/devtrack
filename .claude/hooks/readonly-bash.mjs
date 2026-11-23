// PreToolUse guard for read-only subagents: allow only a small allowlist of read-only commands.
// Usage (from agent frontmatter): node readonly-bash.mjs <profile>   where profile = git | git-audit
// Exit 2 = block (stderr is shown to the agent). Fails open on malformed input (other hooks/permissions still apply).
import { readFileSync } from "node:fs";

const PROFILES = {
  git: ["git diff", "git log", "git show", "git status", "git ls-files"],
  "git-audit": ["git diff", "git log", "git show", "git status", "git ls-files", "npm audit", "npm ls"],
};

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const allowed = PROFILES[process.argv[2]] ?? PROFILES.git;
const cmd = String(input.tool_input?.command ?? "").trim();

// Reject chaining, redirection and substitution so an allowed prefix can't smuggle another command.
const hasOperator = [";", "&", "|", ">", "<", "`", "$(", "\n"].some((op) => cmd.includes(op));
const matches = allowed.some((p) => cmd === p || cmd.startsWith(p + " "));

if (!cmd || hasOperator || !matches) {
  console.error(
    `Blocked: this agent is read-only. Allowed commands: ${allowed.join(", ")} (no pipes, chaining or redirects).`,
  );
  process.exit(2);
}
