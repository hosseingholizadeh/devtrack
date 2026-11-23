// PreToolUse (Bash|PowerShell): deny EVERY `git push`, however it is spelled.
// Exit 2 = block (stderr is shown to Claude). Fails CLOSED on unreadable input or internal errors.
//
// Why a hook and not only permission rules: a rule such as `Bash(git push *)` cannot see
// `git -C dir push`, `git -c k=v push`, `git --no-pager push`, aliases, or a push inside `sh -c "..."`,
// and wildcard rules like `git * push *` also block harmless commands (`git log --grep push`).
// This hook parses the command: it finds each `git`, skips git's global options, and checks the subcommand.
//
// Blocked subcommands: push, send-pack, http-push (all update a remote). `git stash push` is NOT a
// remote push (its subcommand is `stash`) and is allowed. Pushes are always a deliberate human action.
//
// Known limits: a push hidden behind a variable (`$G push`), a script file, or an alias defined only
// in a config file that `git config` cannot read from here.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const failClosed = (why) => {
  console.error(`Blocked by block-git-push hook: ${why}. The guard could not evaluate this command safely.`);
  process.exit(2);
};
process.on("uncaughtException", (e) => failClosed(`internal error (${e?.message ?? e})`));

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  failClosed("unreadable hook input");
}
const command = input.tool_input?.command;
if (command === undefined) process.exit(0); // not a shell command (defensive; the matcher only selects shell tools)
if (typeof command !== "string") failClosed("command is not a string");

const PUSH_SUBCOMMANDS = new Set(["push", "send-pack", "http-push"]);
// Global git options that consume the next token as their value (`--opt=value` forms are single tokens).
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env", "--attr-source"]);
// Words whose quoted arguments are themselves commands: `sh -c "git push"`, `git submodule foreach 'git push'`.
const PAYLOAD_WORDS = new Set(["sh", "bash", "zsh", "dash", "ksh", "cmd", "powershell", "pwsh", "eval", "foreach", "--exec"]);

// Split into segments on unquoted ; & | ( ) ` and newlines; keep quoted text together as ONE token.
function segments(text) {
  const segs = [];
  let tokens = [];
  let cur = null; // {text, quoted}
  let quote = null;
  const endTok = () => {
    if (cur) tokens.push(cur);
    cur = null;
  };
  const endSeg = () => {
    endTok();
    if (tokens.length) segs.push(tokens);
    tokens = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur.text += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur ??= { text: "", quoted: false };
      cur.quoted = true;
    } else if (/\s/.test(ch) && ch !== "\n" && ch !== "\r") {
      endTok();
    } else if (";&|()`\n\r".includes(ch)) {
      endSeg();
    } else {
      cur ??= { text: "", quoted: false };
      cur.text += ch;
    }
  }
  endSeg();
  return segs;
}

let aliasCache;
function aliases() {
  if (aliasCache) return aliasCache;
  aliasCache = new Map();
  const r = spawnSync("git", ["config", "--get-regexp", "^alias\\."], { encoding: "utf8", cwd: input.cwd || process.cwd() });
  for (const line of (r.stdout ?? "").split("\n")) {
    const m = /^alias\.(\S+)\s+(.*)$/.exec(line.trim());
    if (m) aliasCache.set(m[1].toLowerCase(), m[2]);
  }
  return aliasCache;
}

// A quoted token is the git executable only in command position or when it is a path
// (`"C:\Program Files\Git\cmd\git.exe" push`); quoted "git" elsewhere is message text.
const isGit = (t, idx) =>
  /^git(\.exe)?$/i.test(t.text.split(/[\\/]/).pop()) && (!t.quoted || idx === 0 || /[\\/]/.test(t.text));

function pushesViaSubcommand(sub, depth = 0) {
  const s = sub.toLowerCase();
  if (PUSH_SUBCOMMANDS.has(s)) return true;
  const alias = aliases().get(s);
  if (!alias || depth > 3) return false;
  if (alias.startsWith("!")) return /(^|[^\w-])(push|send-pack|http-push)([^\w-]|$)/i.test(alias); // shell alias: be conservative
  return pushesViaSubcommand(alias.trim().split(/\s+/)[0], depth + 1);
}

function pushes(text, depth = 0) {
  if (depth > 3) return true; // absurd nesting: refuse rather than guess
  for (const seg of segments(text)) {
    for (let i = 0; i < seg.length; i++) {
      if (!isGit(seg[i], i)) continue;
      let j = i + 1;
      while (j < seg.length) {
        const t = seg[j].text;
        if (t.startsWith("-")) {
          if (t === "-c") {
            // `-c alias.x=push` defines an alias for this one invocation: treat as unsafe.
            if (/^alias\./i.test(seg[j + 1]?.text ?? "")) return true;
            j += 2;
          } else if (GLOBAL_WITH_VALUE.has(t)) j += 2; // -C <dir>, --git-dir <dir>, ... (case-sensitive: -C != -c)
          else j += 1;
        } else break;
      }
      const sub = seg[j]?.text;
      if (sub && pushesViaSubcommand(sub)) return true;
    }
    // Quoted payloads of shells/foreach/--exec are commands too.
    if (seg.some((t) => !t.quoted && PAYLOAD_WORDS.has(t.text.split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, "")))) {
      for (const t of seg) if (t.quoted && /\s/.test(t.text) && pushes(t.text, depth + 1)) return true;
    }
  }
  return false;
}

if (pushes(command)) {
  console.error(
    "Blocked by block-git-push hook: `git push` (and send-pack/http-push) is never run by Claude in this project. " +
      "Ask the user to run the push themselves.",
  );
  process.exit(2);
}
