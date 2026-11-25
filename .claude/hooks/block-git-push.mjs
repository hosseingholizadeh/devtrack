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
// Parsing follows the shell of the calling tool: POSIX rules for Bash, PowerShell rules for PowerShell (both
// when the tool is unknown). Both understand escapes (`git pu\sh`, PowerShell `` git pu`sh ``), ANSI-C quotes
// (`git $'push'`), and command substitution inside double quotes, which is parsed as real commands with its
// own quoting (`echo "$(echo "a b"; git push)"`).
//
// Bash heredoc bodies are data, not commands, so commit messages written as `-m "$(cat <<'EOF' ... EOF)"` may
// mention `git push`. Two exceptions: a body fed to a shell (`bash <<EOF`, `cat <<EOF | sh`) is a script and is
// scanned as commands, and a body with an UNQUOTED delimiter still runs its `$(...)` and backtick
// substitutions, which are scanned too. A heredoc with no terminator line is scanned as commands.
// Comments (`# ...`, PowerShell `<# ... #>`) are skipped, so a quote, `<<` or `)` inside one cannot change how
// the following lines are read. Redirections between `git` and its subcommand (`git 2>&1 push`) are skipped.
//
// Fails closed (denies) when safe parsing is not possible:
//  - the subcommand is dynamic: a variable, glob, brace expansion or substitution (`git $SUB`, `git "$SUB"`,
//    `git pus?`, `git {push,pull}`), or a dynamic -C/--git-dir/--work-tree value;
//  - runtime config is injected: `--config-env`, `-c alias.*|include.*`, an assignment to GIT_CONFIG*,
//    GIT_DIR, GIT_WORK_TREE or GIT_COMMON_DIR (also `$env:`), or `git config alias.*|include.*`, because each
//    can define an alias or point git at a config this hook cannot read;
//  - git config that can turn a typo into a push is set: `-c help.autocorrect=...` or `git config help.autocorrect`;
//  - the parser cannot follow the text: a `case` statement inside a command substitution (its `)` pattern
//    terminator would end the substitution early), or a backslash inside a backtick substitution (backticks have
//    their own escaping rules);
//  - nesting is absurdly deep, or git's config cannot be read to resolve aliases.
// A broken git config therefore blocks every command containing `git <subcommand>` until it is fixed.
//
// Known false positives (harmless commands that are denied; all fail closed and are rare):
//  - a bare shell word (`sh`, `bash`, `zsh`, `cmd`, `eval`, ... as a whole argument) makes every other quoted or
//    dynamic argument on that command be scanned as a command, so `git commit -m "document git push" -- sh` is
//    denied;
//  - the same trigger words on a heredoc line mark its body as a script, so `cat <<'EOF' | grep sh` followed by
//    a body that mentions `git push` is denied;
//  - the word `case` as an ordinary argument inside a command substitution, e.g. `echo "$(echo case)"`.
//
// Known limits (not a sandbox): a push hidden behind a variable used as the program (`$G push`), a glob or
// substitution that builds the program name, an interpreter fed the command indirectly (`echo ... | sh`,
// `python -c`, `git rebase --exec`, `core.pager`-style config commands), an alias that only exists in a
// config git cannot read from here (`cd other && git p`, a changed HOME/XDG_CONFIG_HOME), PowerShell
// expressions (`git ('pu'+'sh')`, curly quotes), and other programs that push (`gh`, `curl`, `git lfs`,
// `git svn`, ...), which are deliberately out of scope for this hook.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DEFAULT_REASON =
  "`git push` (and send-pack/http-push) is never run by Claude in this project. Ask the user to run the push themselves.";
let reason = DEFAULT_REASON;
const hit = (why) => {
  reason = why;
  return true;
};

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

// false = POSIX rules, true = PowerShell rules. The tool name comes from Claude Code, not from the model.
const MODES = input.tool_name === "Bash" ? [false] : input.tool_name === "PowerShell" ? [true] : [false, true];

const PUSH_SUBCOMMANDS = new Set(["push", "send-pack", "http-push"]);
// Global git options that consume the next token as their value (`--opt=value` forms are single tokens).
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--attr-source"]);
// Global options that select which repository's config (and therefore which aliases) applies.
const REPO_SELECTORS = new Set(["-C", "--git-dir", "--work-tree"]);
// Words whose quoted arguments are themselves commands: `sh -c "git push"`, `git submodule foreach 'git push'`.
const PAYLOAD_WORDS = new Set(["sh", "bash", "zsh", "dash", "ksh", "cmd", "powershell", "pwsh", "eval", "foreach", "--exec"]);
const OTHER_SHELL_WORDS = new Set(["cmd", "powershell", "pwsh"]); // payloads in a different syntax: parse both ways
// Config keys that can define or pull in aliases. Environment variables that do the same or move git elsewhere.
// (`help.autocorrect` can turn a typo such as `psuh` into a push.)
const ALIAS_KEYS = /^((alias|include|includeif)\.|help\.autocorrect)/i;
const CONFIG_ENV = /^(?:\$env:|env:)?(?:GIT_CONFIG\w*|GIT_DIR|GIT_WORK_TREE|GIT_COMMON_DIR)\+?=/i;
// Set when the parser meets something it cannot follow safely (see parse); scan() then fails closed.
let parseUnsafe = null;
const CONFIG_ENV_REF = /^(?:\$env:|env:)(?:GIT_CONFIG\w*|GIT_DIR|GIT_WORK_TREE|GIT_COMMON_DIR)/i; // PowerShell `$env:X = 1`

const ANSI_SIMPLE = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?" };

// Decode the body of a bash ANSI-C string `$'...'`. `i` points just after the opening quote.
// Returns [decoded text, index just after the closing quote].
function ansiC(s, i) {
  let out = "";
  while (i < s.length && s[i] !== "'") {
    if (s[i] !== "\\" || i + 1 >= s.length) {
      out += s[i++];
      continue;
    }
    const c = s[i + 1];
    i += 2;
    if (c in ANSI_SIMPLE) out += ANSI_SIMPLE[c];
    else if (c === "x") {
      const m = /^[0-9a-fA-F]{1,2}/.exec(s.slice(i));
      if (m) {
        out += String.fromCharCode(parseInt(m[0], 16));
        i += m[0].length;
      } else out += "\\x";
    } else if (c === "u" || c === "U") {
      const m = new RegExp(`^[0-9a-fA-F]{1,${c === "u" ? 4 : 8}}`).exec(s.slice(i));
      const cp = m ? parseInt(m[0], 16) : NaN;
      if (m && cp <= 0x10ffff) {
        out += String.fromCodePoint(cp);
        i += m[0].length;
      } else out += `\\${c}`;
    } else if (/[0-7]/.test(c)) {
      const m = /^[0-7]{0,2}/.exec(s.slice(i));
      out += String.fromCharCode(parseInt(c + m[0], 8));
      i += m[0].length;
    } else if (c === "c" && i < s.length) out += String.fromCharCode(s.charCodeAt(i++) & 31);
    else out += `\\${c}`;
  }
  return [out, i + 1];
}

// Read the body of a bash heredoc whose operator was seen on the previous line. `pos` is the index of the first
// body line. Returns {body, next}: the raw body and the index after the terminator line. A heredoc with no
// terminator is not treated as one (returns null), so its "body" is scanned as commands: fail closed.
function readHeredoc(text, pos, h) {
  let body = "";
  while (pos < text.length) {
    const nl = text.indexOf("\n", pos);
    const end = nl < 0 ? text.length : nl;
    let line = text.slice(pos, end).replace(/\r$/, "");
    if (h.strip) line = line.replace(/^\t+/, "");
    if (line === h.delim) return { body, next: nl < 0 ? text.length : nl + 1 };
    body += `${text.slice(pos, end)}\n`;
    pos = nl < 0 ? text.length : nl + 1;
  }
  return null;
}

// Parse command text into segments (lists of tokens) split on unquoted command separators. Quoted text stays
// ONE token. Command substitutions (`$(...)`, backticks) are parsed as commands of their own, with their own
// quoting, and their segments are added to the result. Tokens: {text, quoted, dyn}
//   quoted: any part was quoted; dyn: contains an unquoted OR double-quoted `$`, or an unquoted glob/brace char
//   (the real word is unknowable here).
// `ps` selects PowerShell rules (backtick escapes, `''`/`""` doubling, `{}` separate commands, `\` is literal,
// no heredocs) instead of POSIX rules. `stop` is the closer (")" or a backtick) of a substitution being parsed.
// Returns {segs, end}: `end` is the index of the closer, or text.length.
function parse(text, ps, start = 0, stop = null) {
  const segs = [];
  let tokens = [];
  let cur = null;
  let quote = null;
  let braces = 0; // depth of `${...}` / `$[...]`, where `<<` is not a heredoc
  let lineShell = false; // this line runs a shell (`bash <<EOF`, `cat <<EOF | sh`), so a heredoc body is code
  const pending = []; // heredocs whose bodies start after the next newline
  const open = () => (cur ??= { text: "", quoted: false, dyn: false });
  const endTok = () => {
    if (cur) {
      tokens.push(cur);
      if (PAYLOAD_WORDS.has(basename(cur.text).toLowerCase().replace(/\.exe$/, ""))) lineShell = true;
      // A `)` in a case pattern would end the substitution early and the rest would be read as quoted text.
      if (stop === ")" && !cur.quoted && cur.text === "case") parseUnsafe = "a `case` statement inside a command substitution cannot be parsed safely";
    }
    cur = null;
  };
  const endSeg = () => {
    endTok();
    if (tokens.length) segs.push(tokens);
    tokens = [];
  };
  const nested = (from, closer, src = text, into = segs) => {
    const r = parse(src, ps, from, closer);
    into.push(...r.segs);
    return r.end;
  };
  // Text that is expanded like a string (an unquoted heredoc body, a PowerShell `@"..."@` here-string) still
  // runs the substitutions inside it.
  const expandBody = (body) => {
    for (let k = body.indexOf("$("); k >= 0; k = body.indexOf("$(", k + 1)) nested(k + 2, ")", body);
    if (ps) return;
    for (let k = body.indexOf("`"); k >= 0; ) {
      const end = nested(k + 1, "`", body);
      k = body.indexOf("`", end + 1);
    }
  };
  const separators = ps ? ";&|{}\n\r" : ";&|`\n\r";
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (!ps && stop === "`" && ch === "\\") parseUnsafe = "a backslash inside backticks cannot be parsed safely (use $(...))";
    if (quote === "'") {
      if (ch !== "'") cur.text += ch;
      else if (ps && next === "'") {
        cur.text += "'";
        i++;
      } else quote = null;
    } else if (quote === '"') {
      if (ch === '"') {
        if (ps && next === '"') {
          cur.text += '"';
          i++;
        } else quote = null;
      } else if (!ps && ch === "\\" && next !== undefined && '$`"\\\n'.includes(next)) {
        if (next !== "\n") cur.text += next; // `\<newline>` is a line continuation
        i++;
      } else if (ps && ch === "`" && next !== undefined) {
        cur.text += next;
        i++;
      } else if (ch === "$" && next === "(") {
        cur.dyn = true;
        const end = nested(i + 2, ")");
        cur.text += text.slice(i, end + 1);
        i = end;
      } else if (!ps && ch === "`") {
        cur.dyn = true;
        const end = nested(i + 1, "`");
        cur.text += text.slice(i, end + 1);
        i = end;
      } else {
        if (ch === "$") cur.dyn = true; // `"$SUB"`, `"${SUB}"`
        cur.text += ch;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      open().quoted = true;
    } else if (!ps && ch === "\\") {
      if (next === undefined) continue;
      if (next !== "\n") open().text += next; // `\<newline>` is a line continuation
      i++;
    } else if (ps && ch === "`") {
      if (next === undefined) continue;
      if (next !== "\n" && next !== "\r") open().text += next;
      i++;
    } else if (!ps && ch === "$" && next === "'") {
      const [decoded, end] = ansiC(text, i + 2);
      open().quoted = true;
      cur.text += decoded.split("\0")[0]; // bash truncates an ANSI-C string at the first NUL
      i = end - 1;
    } else if (!ps && ch === "$" && next === '"') {
      quote = '"'; // locale-translated string: same as a double-quoted string
      open().quoted = true;
      i++;
    } else if (ch === "#" && cur === null) {
      // A comment runs to the end of the line (a `#` inside a word, like `a#b` or `$#`, is not one). Skipping it
      // matters: a quote or `<<` or `)` inside a comment must not change how the following lines are parsed.
      const nl = text.indexOf("\n", i);
      i = nl < 0 ? text.length : nl - 1;
    } else if (ps && ch === "<" && next === "#") {
      const e = text.indexOf("#>", i + 2); // PowerShell block comment
      i = e < 0 ? text.length : e + 1;
    } else if (ps && ch === "@" && (next === "'" || next === '"')) {
      // PowerShell here-string: the body runs from the next line to a line that starts with the closing quote + @.
      const e = text.indexOf(`\n${next}@`, i + 2);
      const body = text.slice(i + 2, e < 0 ? text.length : e);
      open().quoted = true;
      cur.text += body;
      if (next === '"') expandBody(body);
      i = e < 0 ? text.length : e + 2;
    } else if (ch === "$" && next === "(") {
      // Unquoted command substitution or `$((arithmetic))`: parsed as commands with their own quoting.
      open().dyn = true;
      const end = nested(i + 2, ")");
      cur.text += text.slice(i, end + 1);
      i = end;
    } else if (ch === "(") {
      // Subshell or PowerShell grouping: its own parse level, so a heredoc inside it ends inside it.
      endSeg();
      i = nested(i + 1, ")");
    } else if (!ps && ch === "<" && next === "<" && text[i + 2] !== "<" && braces === 0) {
      // Heredoc operator (not `<<<`, and not `${x:-<<E}`): its body starts after this line.
      let j = i + 2;
      const strip = text[j] === "-";
      if (strip) j++;
      while (text[j] === " " || text[j] === "\t") j++;
      let delim = "";
      let quotedDelim = false;
      while (j < text.length && !/[\s;&|()<>]/.test(text[j])) {
        const c = text[j];
        if (c === "'" || c === '"') {
          quotedDelim = true;
          const e = text.indexOf(c, j + 1);
          const stopAt = e < 0 ? text.length : e;
          delim += text.slice(j + 1, stopAt);
          j = stopAt + 1;
        } else if (c === "\\") {
          quotedDelim = true;
          delim += text[j + 1] ?? "";
          j += 2;
        } else {
          delim += c;
          j++;
        }
      }
      endTok();
      pending.push({ delim, quotedDelim, strip });
      i = j - 1;
    } else if (/\s/.test(ch) && ch !== "\n" && ch !== "\r") {
      endTok();
    } else if (ch === "&" && (next === ">" || (cur !== null && /[<>]$/.test(cur.text)))) {
      open().text += ch; // part of a redirection (`2>&1`, `&>file`), not a command separator
    } else if (stop === "`" && ch === "`") {
      endSeg();
      return { segs, end: i };
    } else if (stop === ")" && ch === ")") {
      endSeg();
      return { segs, end: i };
    } else if (!ps && ch === "`") {
      // Backtick command substitution (its closing backtick is the `stop` branch above).
      endSeg();
      i = nested(i + 1, "`");
    } else if (separators.includes(ch) || ch === ")") {
      endSeg();
      if (ch === "\n") {
        const shellLine = lineShell;
        lineShell = false;
        for (const h of pending.splice(0)) {
          const r = readHeredoc(text, i + 1, h);
          if (!r) break; // unterminated: keep scanning the rest as commands
          if (shellLine) nested(0, null, r.body); // `bash <<EOF`: the body is a script
          else if (!h.quotedDelim) expandBody(r.body); // unquoted delimiter: `$(...)` and backticks still run
          i = r.next - 1;
        }
      }
    } else {
      open().text += ch;
      if ("$*?[{".includes(ch) || (ps && ch === "@")) cur.dyn = true; // `@x` is PowerShell splatting
      if (!ps) {
        if ((ch === "{" || ch === "[") && text[i - 1] === "$") braces++;
        else if ((ch === "}" || ch === "]") && braces > 0) braces--;
      }
    }
  }
  endSeg();
  return { segs, end: text.length };
}

const segments = (text, ps) => parse(text, ps).segs;

const aliasCache = new Map();
// Aliases visible to git. `prefix` holds repository-selecting global options (-C dir, --git-dir ...), because
// `git -C other p` resolves `p` from the OTHER repository's config.
function aliases(prefix = []) {
  const key = prefix.join("\0");
  if (aliasCache.has(key)) return aliasCache.get(key);
  // -z: NUL-terminated `key\nvalue` entries, so an alias value containing a newline is not truncated.
  const r = spawnSync("git", [...prefix, "config", "-z", "--get-regexp", "^alias\\."], { encoding: "utf8", cwd: input.cwd || process.cwd(), timeout: 5000 });
  if (prefix.length && (r.error || (r.status !== 0 && r.status !== 1))) return aliases(); // target unreadable: git itself would fail
  if (r.error) throw r.error;
  if (r.status !== 0 && r.status !== 1) throw new Error(`git config exited with status ${r.status}`); // 1 = no aliases
  const map = new Map();
  for (const entry of (r.stdout ?? "").split("\0")) {
    const nl = entry.indexOf("\n");
    const m = /^alias\.(.+)$/i.exec(nl < 0 ? entry : entry.slice(0, nl));
    if (m) map.set(m[1].toLowerCase(), nl < 0 ? "" : entry.slice(nl + 1));
  }
  aliasCache.set(key, map);
  return map;
}

// The git executable, by name or path (`"C:\Program Files\Git\cmd\git.exe" push`). Quoted `git` counts too
// (`env 'git' push`); text that merely mentions git is not a problem because the subcommand must also be a push.
const basename = (t) => t.split(/[\\/]/).pop();
const isGit = (t) => /^git(\.exe)?$/i.test(basename(t.text));

// Skip git's global options starting at tokens[j]. Returns {j, deny, prefix}: j indexes the subcommand,
// deny is set for options that inject runtime config or point at an unknowable repository, prefix lists
// repository-selecting options.
function skipGlobals(tokens, j) {
  const prefix = [];
  const denied = (why) => ({ j, deny: hit(why), prefix });
  while (j < tokens.length) {
    const t = tokens[j].text;
    if (/^(\d*|&)[<>]/.test(t)) {
      // A redirection between `git` and the subcommand (`git >/dev/null push`, `git 2>&1 push`): skip it, and
      // its target when the operator stands alone (`git > out push`).
      j += /^(\d*|&)(>>?|<)$/.test(t) ? 2 : 1;
      continue;
    }
    if (!t.startsWith("-")) break;
    if (t.startsWith("--config-env")) return denied("`--config-env` injects git config from the environment, which can define a push alias");
    if (t === "-c") {
      // `-c alias.x=push` / `-c include.path=...` define or pull in aliases for this one invocation: unsafe.
      if (ALIAS_KEYS.test(tokens[j + 1]?.text ?? "") || tokens[j + 1]?.dyn)
        return denied("`-c alias.*`/`-c include.*`/`-c help.autocorrect` (or a dynamic -c key) can define a push alias");
      j += 2;
    } else if (GLOBAL_WITH_VALUE.has(t)) {
      // -C <dir>, --git-dir <dir>, ... (case-sensitive: -C != -c)
      if (REPO_SELECTORS.has(t) && tokens[j + 1]) {
        if (tokens[j + 1].dyn) return denied(`a dynamic ${t} value selects a repository whose aliases cannot be resolved`);
        prefix.push(t, tokens[j + 1].text);
      }
      j += 2;
    } else {
      if (/^--(git-dir|work-tree)=/.test(t)) {
        if (tokens[j].dyn) return denied(`a dynamic ${t.split("=")[0]} value selects a repository whose aliases cannot be resolved`);
        prefix.push(t);
      }
      j += 1;
    }
  }
  return { j, deny: false, prefix };
}

const resolving = new Set(); // aliases being expanded right now: `alias.log = !git log` must not recurse forever

function pushesViaSubcommand(sub, prefix, depth = 0) {
  const s = sub.toLowerCase();
  if (PUSH_SUBCOMMANDS.has(s)) return true;
  // Prefix aliases (from -C / --git-dir) override the current repository's.
  const alias = new Map([...aliases(), ...aliases(prefix)]).get(s);
  if (!alias) return false;
  if (resolving.has(s)) return false; // an alias that refers to itself runs the git builtin of that name
  if (depth > 3) return true; // alias chain too deep to follow: refuse rather than guess
  resolving.add(s);
  try {
    if (alias.startsWith("!")) {
      // Shell alias: parse it as a command, and also stay conservative about the bare words.
      return pushes(alias.slice(1), depth + 1, [false]) || /(^|[^\w-])(push|send-pack|http-push)([^\w-]|$)/i.test(alias);
    }
    // A git alias is an argument list that may itself start with global options (`-C . push`).
    const tokens = segments(alias, false)[0] ?? [];
    const g = skipGlobals(tokens, 0);
    if (g.deny) return true;
    const first = tokens[g.j];
    if (!first) return false;
    if (first.dyn) return hit("a git alias expands to a dynamic subcommand");
    return pushesViaSubcommand(first.text, [...prefix, ...g.prefix], depth + 1);
  } finally {
    resolving.delete(s);
  }
}

function scan(text, ps, depth) {
  parseUnsafe = null;
  const segs = segments(text, ps);
  if (parseUnsafe) return hit(parseUnsafe);
  for (const seg of segs) {
    for (const t of seg) {
      if (CONFIG_ENV.test(t.text) || CONFIG_ENV_REF.test(t.text))
        return hit("assigning GIT_CONFIG*/GIT_DIR/GIT_WORK_TREE/GIT_COMMON_DIR can define a push alias or move git to an unreadable config");
      // `git${IFS}push`: the shell builds the program name from an expansion.
      if (t.dyn && /^git(\.exe)?(?=[$*?[{])/i.test(basename(t.text))) return hit("the git program name is built by an expansion");
    }
    for (let i = 0; i < seg.length; i++) {
      if (!isGit(seg[i])) continue;
      const g = skipGlobals(seg, i + 1);
      if (g.deny) return true;
      const sub = seg[g.j];
      if (!sub) continue;
      // `git $SUB`, `git "$SUB"`, `git pus?`, `git {push,pull}`: cannot tell what runs.
      if (sub.dyn) return hit("the git subcommand is built dynamically ($VAR, glob, brace or substitution) and cannot be checked");
      if (sub.text.toLowerCase() === "config" && seg.slice(g.j + 1).some((t) => ALIAS_KEYS.test(t.text)))
        return hit("`git config alias.*|include.*` can define a push alias");
      if (pushesViaSubcommand(sub.text, g.prefix, depth)) return true;
    }
    // Arguments of shells/foreach/--exec are commands too (`sh -c "git push"`, `'bash' -c 'git${IFS}push'`,
    // `sh -c git\ push`): scan every argument that is quoted, has spaces or is dynamic.
    const words = seg.map((t) => basename(t.text).toLowerCase().replace(/\.exe$/, ""));
    if (words.some((w) => PAYLOAD_WORDS.has(w))) {
      const modes = words.some((w) => OTHER_SHELL_WORDS.has(w)) ? [false, true] : [ps];
      for (const t of seg) if ((t.quoted || t.dyn || /\s/.test(t.text)) && pushes(t.text, depth + 1, modes)) return true;
    }
  }
  return false;
}

function pushes(text, depth = 0, modes = MODES) {
  if (depth > 3) return hit("command nesting is too deep to check"); // absurd nesting: refuse rather than guess
  return modes.some((ps) => scan(text, ps, depth));
}

if (pushes(command)) {
  console.error(`Blocked by block-git-push hook: ${reason}`);
  process.exit(2);
}
