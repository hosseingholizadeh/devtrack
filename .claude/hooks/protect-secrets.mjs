// PreToolUse guardrail: block access to secret files (dotenv files, credentials, keys) via any tool.
// Exit 2 = block (stderr is shown to Claude). Fails open on malformed input.
// Example files (.env.example/.sample/.template) stay accessible.
//
// This is defense in depth next to the `permissions.deny` rules in settings.json. It cannot stop
// every obfuscated shell trick (e.g. building a filename from variables); use the sandbox for that.
import { readFileSync } from "node:fs";
import { matchesGlob } from "node:path";

process.removeAllListeners("warning"); // matchesGlob may print an "experimental" warning on some Node versions

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};

// Which tool_input fields are file paths/globs/commands, per tool. Grep's `pattern` is a content
// regex (not a path), so it is deliberately not inspected.
const FIELDS = {
  Bash: ["command"],
  Glob: ["pattern", "path"],
  Grep: ["path", "glob"],
};
const fields = FIELDS[tool] ?? ["file_path", "notebook_path", "path"];
const values = fields.map((f) => ti[f]).filter((v) => typeof v === "string" && v.length > 0);

const E = "." + "env";
const SAMPLE_NAMES = [E, `${E}.local`, `${E}.production`, `${E}.development.local`, ".credentials.json"];

// 1. Literal mentions. `.env` not preceded by a word char; allowed only when it is exactly an example file.
const ENV_RE = new RegExp(`(?<![A-Za-z0-9_])\\${E.slice(0, 1)}${E.slice(1)}([^\\s"'/\\\\;&|)<>\`]*)`, "gi");
const SAFE_SUFFIX = /^\.(example|sample|template)$/i;
// Deliberately conservative (some false positives, e.g. an identifier named `item.key` in a Bash
// command, `.envrc`): a blocked call just means asking the user. Known limits: computed filenames,
// 8.3 short names and secrets already committed to git history are not detectable here.
const OTHER_SECRETS =
  /\.credentials\.json|\.git-credentials|\.aws[\\/]credentials|(^|[\\/\s"'=:])\.(npmrc|netrc)(?![\w-])|\.(pem|key|pfx|p12)(?![\w-])|(^|[\\/\s"'=:])id_(rsa|ecdsa|ed25519)(?![\w-])/i;

function literalHit(text) {
  for (const m of text.matchAll(ENV_RE)) {
    if (!SAFE_SUFFIX.test(m[1])) return true;
  }
  return OTHER_SECRETS.test(text);
}

// 2. Wildcards that would expand to a secret file (e.g. `.e*`, `.en?`, `{.env,x}`, `.[e]nv`).
//    matchesGlob uses shell-like dot semantics: `*` does not match a leading dot.
function globHit(token, { dotless }) {
  const t = token.replace(/^\.\//, "");
  if (!/[*?[{]/.test(t)) return false;
  const dir = t.includes("/") ? t.slice(0, t.lastIndexOf("/") + 1) : "";
  const names = dotless ? SAMPLE_NAMES.flatMap((n) => [n, n.replace(/^\./, "")]) : SAMPLE_NAMES;
  return names.some((n) => {
    try {
      return matchesGlob(dir + n, t) || matchesGlob(n, t);
    } catch {
      return false;
    }
  });
}

// Split a command into whitespace-separated words, masking quoted characters with `_`: the shell
// never glob-expands quoted text, so e.g. the regex in `sed 's|.*|x|'` must not count as a glob.
function unquotedWords(cmd) {
  const words = [];
  let cur = "";
  let quote = null;
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += "_";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) words.push(cur);
  return words;
}

function blocked() {
  for (const raw of values) {
    // Also check with quotes/backslashes removed so `.e"nv"` style splitting doesn't hide the name.
    const variants = [raw, raw.replace(/["'\\]/g, "")];
    if (variants.some(literalHit)) return true;
    const tokens = tool === "Bash" ? unquotedWords(raw) : [raw];
    // Grep's `glob` is a ripgrep glob: it can override hidden/ignore rules, so `*` DOES reach dotfiles.
    const dotless = tool === "Grep" && raw === ti.glob;
    if (tokens.some((t) => globHit(t, { dotless }))) return true;
  }
  return false;
}

if (blocked()) {
  console.error(
    "Blocked by protect-secrets hook: this touches a secret/credential file (dotenv, credentials, keys). " +
      "Use the .env.example file or ask the user for the non-secret value instead.",
  );
  process.exit(2);
}
