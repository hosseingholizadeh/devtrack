// @vitest-environment node
// Tests for the Claude Code guardrail hooks and the permission rules in .claude/settings.json.
// Hooks are exercised exactly as Claude Code runs them: a node process fed JSON on stdin.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, matchesGlob } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const hook = (name) => join(here, name);
const tmpRoot = mkdtempSync(join(tmpdir(), "devtrack-hooks-")); // removed in afterAll below
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));
const emptyGitConfig = join(tmpRoot, "gitconfig"); // /dev/null is not usable as a config file on Windows
writeFileSync(emptyGitConfig, "");
// Keeps the host's global/system git config (aliases, includes, a broken file) out of every hook run.
const ISOLATED = { GIT_CONFIG_GLOBAL: emptyGitConfig, GIT_CONFIG_NOSYSTEM: "1" };
const posix = (p) => p.replaceAll("\\", "/"); // a backslash path inside a POSIX double-quoted string is fragile
const gitIn = (cwd, args) => {
  const r = spawnSync("git", args, { cwd, env: { ...process.env, ...ISOLATED }, encoding: "utf8" });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
};
const E = "." + "env"; // dotenv file name, built so this file is easy to grep without noise

function run(script, payload, { env = {}, argv = [], raw } = {}) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [hook(script), ...argv], {
    input: raw ?? JSON.stringify(payload),
    env: { ...process.env, ...ISOLATED, CLAUDE_PROJECT_DIR: repo, ...env },
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, ms: Date.now() - t0 };
}

describe("protect-secrets", () => {
  const check = (tool_name, tool_input) => run("protect-secrets.mjs", { tool_name, tool_input }).status;

  test.each([
    ["Read dotenv", "Read", { file_path: `C:\\Projects\\devtrack\\${E}` }],
    ["Read dotenv.local (windows path)", "Read", { file_path: `C:\\Projects\\devtrack\\${E}.local` }],
    ["Edit nested production", "Edit", { file_path: `/x/app/${E}.production` }],
    ["Write dotenv", "Write", { file_path: `${E}` }],
    ["NotebookEdit dotenv", "NotebookEdit", { notebook_path: `${E}.local` }],
    ["Read credentials", "Read", { file_path: "C:/Users/me/.claude/.credentials.json" }],
    ["Read pem", "Read", { file_path: "certs/server.pem" }],
    ["Read ssh key", "Read", { file_path: "/home/me/.ssh/id_rsa" }],
    ["Glob literal", "Glob", { pattern: `**/${E}*` }],
    ["Glob wildcard", "Glob", { pattern: ".e*" }],
    ["Glob via path", "Glob", { pattern: "*", path: `/x/${E}.local` }],
    ["Grep glob literal", "Grep", { pattern: "KEY", glob: `${E}*` }],
    ["Grep glob wildcard", "Grep", { pattern: "KEY", glob: ".e*" }],
    ["Grep glob star (ripgrep reaches dotfiles)", "Grep", { pattern: "KEY", glob: "*" }],
    ["Grep path to dotenv", "Grep", { pattern: "KEY", path: `${E}.local` }],
    ["PowerShell Get-Content", "PowerShell", { command: `Get-Content ${E}.local` }],
    ["PowerShell wildcard", "PowerShell", { command: "Get-Content .e*" }],
    ["Bash cat", "Bash", { command: `cat ${E}` }],
    ["Bash cat nested", "Bash", { command: `cat app/${E}.production` }],
    ["Bash cat trailing wildcard", "Bash", { command: `cat ${E}*` }],
    ["Bash cat with ./", "Bash", { command: `cat ./${E}` }],
    ["Bash glob expansion", "Bash", { command: "cat .e*" }],
    ["Bash glob single char", "Bash", { command: "cat .en?" }],
    ["Bash brace expansion", "Bash", { command: `cat {${E},x}` }],
    ["Bash char class", "Bash", { command: "cat .[e]nv" }],
    ["Bash quoted-split name", "Bash", { command: `cat ".e"nv` }],
    ["Bash piped", "Bash", { command: `type ${E} | clip` }],
    ["Bash redirect source", "Bash", { command: `sort < ${E}.local` }],
    ["Bash after &&", "Bash", { command: `echo hi && cat ${E}` }],
    ["Bash example-prefixed secret", "Bash", { command: `cat ${E}.example.local` }],
    ["Read npmrc", "Read", { file_path: "C:/Users/me/.npmrc" }],
    ["Read netrc", "Read", { file_path: "/home/me/.netrc" }],
    ["Read git-credentials", "Read", { file_path: "/home/me/.git-credentials" }],
    ["Read aws credentials", "Read", { file_path: "C:\\Users\\me\\.aws\\credentials" }],
    ["Read ecdsa key", "Read", { file_path: "/home/me/.ssh/id_ecdsa" }],
    ["Read pfx", "Read", { file_path: "certs/site.pfx" }],
    ["Read dotenv.staging", "Read", { file_path: `${E}.staging` }],
  ])("blocks: %s", (_n, tool, input) => {
    expect(check(tool, input)).toBe(2);
  });

  test.each([
    ["Read example", "Read", { file_path: `/x/${E}.example` }],
    ["Read sample", "Read", { file_path: `/x/${E}.sample` }],
    ["Read template", "Read", { file_path: `C:\\x\\${E}.template` }],
    ["Bash cat example", "Bash", { command: `cat ${E}.example` }],
    ["Glob example", "Glob", { pattern: `**/${E}.example` }],
    ["Grep glob ts only", "Grep", { pattern: "KEY", glob: "*.ts" }],
    ["Grep glob src subtree", "Grep", { pattern: "x", glob: "src/**/*.tsx" }],
    ["Grep for process.env in code", "Grep", { pattern: "process\\.env\\.NODE_ENV" }],
    ["Read env.ts source", "Read", { file_path: "src/environment.ts" }],
    ["Read process-env helper", "Read", { file_path: "src/lib/process.env.ts" }],
    ["Bash plain", "Bash", { command: "npm run lint && git status" }],
    ["Bash wildcard that cannot hit secrets", "Bash", { command: "ls *.log src/*.ts" }],
    ["Bash bare star (shell skips dotfiles)", "Bash", { command: "ls *" }],
    ["Bash sed regex in quotes", "Bash", { command: "sed -i 's|^a: .*|b|' file.md" }],
    ["Bash echo mentioning process.env", "Bash", { command: "grep -rn process.env src" }],
    ["Edit normal file", "Edit", { file_path: "src/app/page.tsx" }],
  ])("allows: %s", (_n, tool, input) => {
    expect(check(tool, input)).toBe(0);
  });

  // Security guards fail CLOSED. A crash would otherwise exit 1, which Claude Code treats as a
  // non-blocking error (i.e. the tool call would proceed).
  test.each([
    ["garbage", "not JSON"],
    ["", "empty input"],
    ["null", "JSON null (makes the hook throw internally)"],
  ])("fails closed on unreadable or unexpected input: %j (%s)", (raw) => {
    const r = run("protect-secrets.mjs", null, { raw });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Blocked by protect-secrets/);
  });
});

describe("block-git-push (permission decision for every push spelling; nothing is executed)", () => {
  const decide = (command) => run("block-git-push.mjs", { tool_name: "Bash", tool_input: { command } }).status;

  test.each([
    "git push",
    "git push origin main",
    "git push --force origin main",
    "git push origin main --force",
    "git push -f",
    "git push -uf origin HEAD", // combined flags
    "git push --force-with-lease",
    "git push origin :old-branch", // refspec deletion
    "git push origin +HEAD:main", // force refspec
    "git push --delete origin old-branch",
    "git push --mirror",
    "git push --tags",
    "git -C . push",
    "git -C src/app push origin main",
    "git -c core.pager=cat push",
    "git -c user.name=x -c user.email=y push",
    "git --no-pager push",
    "git --git-dir=.git push",
    "git --git-dir .git push",
    "git --work-tree . push",
    "git -C . -c k=v --no-pager push",
    "GIT push", // case-insensitive on Windows
    "git.exe push",
    "C:/Program Files/Git/cmd/git.exe push",
    '"C:\\Program Files\\Git\\cmd\\git.exe" push',
    "/usr/bin/git push",
    "git send-pack origin",
    "git http-push origin",
    "git status && git push",
    "git status; git push",
    "git status | git push",
    "echo hi\ngit push",
    "(git push)",
    "$(git push)",
    "env GIT_TRACE=1 git push",
    "xargs git push",
    "& git push",
    'sh -c "git push origin main"',
    "bash -c 'git -C . push'",
    'powershell -Command "git push"',
    'eval "git push"',
    "git submodule foreach 'git push'",
    "git -c alias.p=push p", // alias defined on the command line
  ])("denies: %s", (cmd) => expect(decide(cmd)).toBe(2));

  // The Bash tool uses POSIX quoting; the PowerShell tool uses PowerShell quoting.
  const decidePs = (command) => run("block-git-push.mjs", { tool_name: "PowerShell", tool_input: { command } }).status;

  // Shell-level escaping: the shell turns each of these into a plain `git push`.
  test.each([
    String.raw`git pu\sh`, // POSIX backslash escape
    String.raw`git \push`,
    String.raw`g\it push origin main`,
    "git $'push'", // ANSI-C quoting
    String.raw`git $'pu\x73h'`, // ANSI-C hex escape
    String.raw`git $'\160ush'`, // ANSI-C octal escape
    String.raw`git $'push'`, // ANSI-C unicode escape
    String.raw`git $'\x70\x75\x73\x68' origin`,
    'git $"push"', // locale-translated string
    'git p""ush',
    "git pu''sh",
    "git 'pu''sh'", // adjacent single-quoted strings are one word in POSIX
    "git pu\\\nsh", // line continuation joins the word
    "env 'git' push", // quoted program name after a prefix word
    'sudo "git" push',
  ])("Bash: denies escaped or quoted push spelling: %s", (cmd) => expect(decide(cmd)).toBe(2));

  test.each([
    "git pu`sh origin main", // backtick escapes the next character in PowerShell
    "git `push",
    "git `pu`sh",
    'git "pu`sh"',
    "& { git push }",
    "<# it's a comment #>; git push", // block comment with an apostrophe must not hide the push
    "$x = @'\nit's\n'@\ngit push", // here-string whose body has an odd number of apostrophes
    '$x = @"\n$(git push)\n"@', // an expandable here-string runs $() inside it
    "$a = 'push'; git @a", // splatting builds the subcommand
  ])("PowerShell: denies %s", (cmd) => expect(decidePs(cmd)).toBe(2));

  test.each([
    "git 'pu''sh'", // doubled single quote is a literal quote in PowerShell: the word is pu'sh, not a push
    "git commit -m @'\nmention git push here\n'@", // single-quoted here-string is data
    "git status # it's fine",
  ])("PowerShell: allows %s", (cmd) => expect(decidePs(cmd)).toBe(0));

  // Command substitution inside double quotes runs as a command, with its own quoting.
  test.each([
    'echo "$(git push)"',
    'echo "$(git -C . push origin main)"',
    'echo "`git push`"',
    'echo "x $(echo a; git push) y"',
    'echo "$(echo "$(git push)")"', // nested substitution
    'echo "$(echo "a b"; git push)"', // quoted argument with a space inside the substitution
    'echo "$(git commit -m "a b"; git push)"',
    `echo "$(echo 'a ) b'; git push)"`, // a `)` inside quotes does not end the substitution
    'echo "$(echo "$(echo "x y")"; git push)"',
    "echo \"`echo 'a b'; git push`\"",
    String.raw`git commit -m "ok" && echo "$(git pu\sh)"`,
    "git commit -m \"$(cat <<'EOF'\ndon't push\nEOF\n)\" && git push", // heredoc with an apostrophe, then a real push
    "git commit -m \"$(cat <<EOF\n$(git push)\nEOF\n)\"", // unquoted heredoc delimiter: body expands substitutions
    "cat <<EOF\nhello\nEOF\ngit push", // a command after the heredoc
    ": $((1<<3))\ngit push", // `<<` inside arithmetic is not a heredoc
    "cat <<EOF\ngit push", // unterminated heredoc is scanned as commands
  ])("Bash: denies push hidden in a substitution or after a heredoc: %s", (cmd) => expect(decide(cmd)).toBe(2));

  test("PowerShell: $() subexpressions inside double quotes run as commands", () => {
    expect(decidePs('echo "$(git push)"')).toBe(2);
    expect(decidePs('echo "$(echo "a b"; git push)"')).toBe(2);
    expect(decidePs('echo "$(git status)"')).toBe(0);
  });

  // Comments, redirections, heredocs and subshells must not change how the following lines are read.
  test.each([
    "echo hi # <<EOF\ngit push\nEOF", // `# <<EOF` is a comment, not a heredoc: the push runs
    ": # '\ngit push", // an apostrophe in a comment is not a quote
    'echo "$(echo a # )\ngit push)"', // a `)` in a comment does not close the substitution
    "git status # it's\ngit push",
    "git >/dev/null push",
    "git 2>&1 push",
    "git </dev/null push origin",
    "git > out.txt push",
    "git -C . >/dev/null push",
    "bash <<'EOF'\ngit push\nEOF", // a heredoc fed to a shell is a script
    "sh <<EOF\ngit push\nEOF",
    "cat <<EOF | sh\ngit push\nEOF",
    "msg=$(cat <<'EOF'\ndon't\nEOF\n); git push", // heredoc inside an unquoted $( ) with an apostrophe in the body
    "(cat <<'EOF'\ndon't\nEOF\n); git push", // ... and inside a subshell
    "echo ${x:-<<E }\ngit push\nE", // `<<` inside ${...} is not a heredoc
    "echo $[1<<2]\ngit push\n2",
    'echo "$(case x in x) git push;; esac)"', // a case pattern's ) ends the substitution early: fail closed
    "echo `echo \\`git push\\``", // escaped, nested backticks
    "echo `git pu\\\\sh`", // backslash rules inside backticks differ: fail closed
    "'bash' -c 'git push'", // quoted shell name
    '"sh" -c "git push"',
    "env 'sh' -c 'git push'",
    "sh -c git\\ push", // escaped space: one unquoted word
    "bash -c 'git${IFS}push'", // no whitespace in the payload
    "GIT_CONFIG_COUNT+=1 GIT_CONFIG_KEY_0+=alias.p GIT_CONFIG_VALUE_0+=push git p",
    "git -c $K=push x", // dynamic -c key
    'git -c "$K=push" x',
    "git -c help.autocorrect=immediate pusj", // autocorrect can turn a typo into a push
    "git config help.autocorrect immediate",
    "git $'push\\0x'", // bash truncates an ANSI-C string at NUL
  ])("Bash: denies %s", (cmd) => expect(decide(cmd)).toBe(2));

  // The subcommand is built at runtime, so it cannot be checked: fail closed.
  test.each([
    "git $SUB",
    "git ${SUB}",
    'git "$SUB" origin',
    'git "${SUB}" origin',
    'git "$(echo push)" origin',
    'git "pu$(echo sh)"',
    "git pus?",
    "git pu*",
    "git {push,pull}",
    "git${IFS}push",
    "git -C . $SUB origin",
    'git -C "$D" p', // alias would come from an unknowable repository
    "git --git-dir=$D p",
  ])("denies a dynamic subcommand or repository: %s", (cmd) => expect(decide(cmd)).toBe(2));

  // Runtime git config can define a push alias that the hook cannot see.
  test.each([
    "git --config-env=alias.p=PUSHVAR p",
    "git --config-env alias.p=PUSHVAR p",
    "git --config-env=core.pager=X status",
    "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.p GIT_CONFIG_VALUE_0=push git p",
    "GIT_CONFIG_PARAMETERS=\"'alias.p=push'\" git p",
    "GIT_CONFIG_GLOBAL=/tmp/evil git p",
    "GIT_CONFIG_SYSTEM=/tmp/evil git p",
    "export GIT_CONFIG_COUNT=1; git status",
    "env GIT_CONFIG_KEY_0=alias.p git status",
    'env GIT_CONF"IG"_COUNT=1 GIT_CONF"IG"_KEY_0=alias.p GIT_CONF"IG"_VALUE_0=push git p', // names built by quoting
    "GIT_DIR=/other/.git git p",
    "GIT_WORK_TREE=/other git p",
    "git -c alias.p='-C . push' p",
    "git -c include.path=/tmp/evil.cfg p",
    "git -c includeIf.gitdir:/.path=/tmp/evil.cfg p",
    "git config alias.p push && git p", // defines and uses an alias in one command
    "git config --global alias.p push",
    "git config include.path /tmp/evil.cfg",
  ])("Bash: denies injected or defined git config: %s", (cmd) => expect(decide(cmd)).toBe(2));

  test.each(["$env:GIT_CONFIG_COUNT=1; git p", "$env:GIT_CONFIG_COUNT = 1; git p", "$env:GIT_DIR='x'; git p"])(
    "PowerShell: denies environment config injection: %s",
    (cmd) => expect(decidePs(cmd)).toBe(2),
  );

  // Legitimate commands must keep working, including ones that merely mention the dangerous words.
  test.each([
    "git commit -m \"it's fine\"",
    'git commit -m "fix $(date)"', // harmless substitution inside a message
    "git commit -m \"$(cat <<'EOF'\nfix: stop git push in the hook\n\nCo-Authored-By: someone\nEOF\n)\"", // routine heredoc commit
    "git commit -m \"$(cat <<'EOF'\ndon't run `git push`; GIT_CONFIG_COUNT=1 is ignored\nEOF\n)\"",
    "git commit -m \"$(cat <<-'EOF'\n\tgit push\n\tEOF\n)\"",
    "cat <<'EOF' > notes.txt\ngit push\nEOF\ngit status",
    'echo "$(git status)"',
    'echo "`git log -1`"',
    'git commit -m "x $HOME"', // a variable in a message is not the subcommand
    'git commit -m "mention GIT_CONFIG_COUNT docs"',
    "git log --grep GIT_CONFIG",
    "grep -rn GIT_CONFIG .claude",
    "git commit -m 'set GIT_DIR=x for tests'",
    String.raw`git log --grep "pu\sh"`, // escape text outside the subcommand position
    String.raw`git commit -m "uses git pu\sh docs"`,
    "git commit -m $'line one\\nline two'", // ANSI-C in a message
    String.raw`git sta\tus`,
    "git log --format=%H -1",
    "git show HEAD@{1}",
    "git log -- 'src/*.ts'",
    "git diff $(git merge-base HEAD origin/develop)",
    "echo $((1<<3))",
    "echo $HOME/.gitconfig",
    "ls gitlab-*.log",
    "git config --get user.name",
    "git config --get-regexp '^alias\\.'",
    "git -c core.pager=cat -c color.ui=never log -1",
    "git 'status'",
    "echo 'git' status",
    'git commit -m "a#b"', // `#` inside a word is not a comment
    "echo $#",
    "git status # trailing comment mentioning git push",
    "git log --grep=#123",
    "git status >/dev/null",
    "git status 2>&1",
    "git diff > out.patch",
    "git commit -m \"$(cat <<'EOF'\nit's about git push\nEOF\n)\" 2>&1",
    "msg=$(cat <<'EOF'\ndon't push\nEOF\n); git commit -m \"$msg\"", // heredoc inside an unquoted $( )
    "(cat <<'EOF'\ndon't push\nEOF\n) > notes.txt; git status",
    "echo $((1<<3)); git status",
    "echo ${x:-default}; git status",
    "bash script.sh",
    "bash -c 'echo hi'",
    "cat <<'EOF' | grep push\nhello git push\nEOF", // a heredoc into grep is data
  ])("still allows: %s", (cmd) => expect(decide(cmd)).toBe(0));

  test("a denial says why, so config-injection is not reported as a push", () => {
    const why = (command) => run("block-git-push.mjs", { tool_name: "Bash", tool_input: { command } }).stderr;
    expect(why("git push")).toMatch(/never run by Claude/);
    expect(why("GIT_CONFIG_COUNT=1 git status")).toMatch(/GIT_CONFIG/);
    expect(why("git $SUB")).toMatch(/dynamic/);
  });

  test.each([
    "git status",
    "git status --short",
    "git log --oneline -5",
    "git log --grep push --oneline",
    "git log --grep=push",
    "git diff",
    "git diff --stat HEAD~1",
    "git show HEAD",
    "git -C src status",
    "git -c core.pager=cat log -1",
    "git commit -m 'document how to git push safely'", // message text is not a command
    'git commit -m "fix push bug"',
    "git stash push -m wip", // local stash, not a remote push
    "git stash push",
    "git branch --list",
    "git remote -v",
    "git fetch origin",
    "git pull",
    "git checkout -b feature/pushnotes",
    'echo "git push"', // quoted text outside a shell wrapper is data
    "npm run lint",
    "ls src",
    "pushd src",
    "git -C src diff -- push.txt",
  ])("allows: %s", (cmd) => expect(decide(cmd)).toBe(0));

  test("denies a push through a repository alias without running it", () => {
    // Throwaway repo whose config aliases `p` (and a shell alias `sp`) to a push; nothing is pushed.
    const dir = mkdtempSync(join(tmpdir(), "devtrack-pushalias-"));
    try {
      gitIn(dir, ["init", "-q"]);
      gitIn(dir, ["config", "alias.p", "push"]);
      gitIn(dir, ["config", "alias.up", "push -u origin HEAD"]);
      gitIn(dir, ["config", "alias.sp", "!git push origin"]);
      gitIn(dir, ["config", "alias.st", "status -sb"]);
      const d = (command) =>
        run("block-git-push.mjs", { tool_name: "Bash", tool_input: { command }, cwd: dir }, { env: ISOLATED }).status;
      expect(d("git p")).toBe(2);
      expect(d("git up")).toBe(2);
      expect(d("git sp")).toBe(2);
      expect(d("git st")).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("denies aliases whose value reaches a push through global options, other repos or chains", () => {
    const mk = (aliases) => {
      const dir = mkdtempSync(join(tmpdir(), "devtrack-pushalias2-"));
      gitIn(dir, ["init", "-q"]);
      for (const [k, v] of Object.entries(aliases)) gitIn(dir, ["config", `alias.${k}`, v]);
      return dir;
    };
    const target = mk({ opt: "-C . push", cfg: "-c core.pager=cat push", chain: "opt", safe: "-C . status", dyn: "$SUB", sh: "!sh -c 'git push'", log: "!git log --oneline", envp: "!GIT_CONFIG_COUNT=1 git status" });
    const plain = mk({});
    try {
      const d = (command, cwd) => run("block-git-push.mjs", { tool_name: "Bash", tool_input: { command }, cwd }, { env: ISOLATED }).status;
      expect(d("git opt", target)).toBe(2); // alias value starts with a global option
      expect(d("git cfg", target)).toBe(2);
      expect(d("git chain", target)).toBe(2); // alias of an alias
      expect(d("git dyn", target)).toBe(2); // dynamic alias subcommand: fail closed
      expect(d("git sh", target)).toBe(2); // shell alias that runs a quoted push
      expect(d("git envp", target)).toBe(2);
      expect(d("git safe", target)).toBe(0);
      expect(d("git log", target)).toBe(0); // alias that shadows a builtin and refers to itself: no endless recursion
      // The alias lives in another repository, selected with -C / --git-dir / --work-tree.
      expect(d(`git -C "${posix(target)}" opt`, plain)).toBe(2);
      expect(d(`git --git-dir="${posix(target)}/.git" opt`, plain)).toBe(2);
      expect(d(`git -C "${posix(target)}" safe`, plain)).toBe(0);
      expect(d("git opt", plain)).toBe(0); // not an alias here, so just an unknown subcommand
    } finally {
      rmSync(target, { recursive: true, force: true });
      rmSync(plain, { recursive: true, force: true });
    }
  });

  test("fails closed when git's alias config cannot be read", () => {
    const dir = mkdtempSync(join(tmpdir(), "devtrack-badcfg-"));
    try {
      gitIn(dir, ["init", "-q"]);
      writeFileSync(join(dir, ".git", "config"), "[broken\n");
      const r = run("block-git-push.mjs", { tool_name: "Bash", tool_input: { command: "git status" }, cwd: dir }, { env: ISOLATED });
      expect(r.status).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("PowerShell tool input is evaluated the same way", () => {
    expect(run("block-git-push.mjs", { tool_name: "PowerShell", tool_input: { command: "git -C . push" } }).status).toBe(2);
    expect(run("block-git-push.mjs", { tool_name: "PowerShell", tool_input: { command: "git status" } }).status).toBe(0);
  });

  test("fails closed on unreadable or unexpected input", () => {
    for (const raw of ["garbage", "", "null"]) {
      const r = run("block-git-push.mjs", null, { raw });
      expect([raw, r.status]).toEqual([raw, 2]);
    }
    expect(run("block-git-push.mjs", { tool_input: { command: 42 } }).status).toBe(2);
  });

  test("non-shell tool input without a command is ignored", () => {
    expect(run("block-git-push.mjs", { tool_name: "Read", tool_input: { file_path: "a.ts" } }).status).toBe(0);
  });
});

describe("readonly-bash", () => {
  test.each([["garbage"], [""], ["null"]])("fails closed on unreadable or unexpected input: %j", (raw) => {
    const r = run("readonly-bash.mjs", null, { raw, argv: ["git"] });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Blocked/);
  });

  const check = (command, profile = "git", extra = {}) =>
    run("readonly-bash.mjs", { tool_name: "Bash", tool_input: { command }, ...extra }, { argv: [profile] }).status;

  test.each([
    "git diff",
    "git diff HEAD",
    "git diff origin/develop...HEAD --stat",
    "git log --oneline -5",
    "git show HEAD",
    "git status",
    "git ls-files",
    "git -C . diff --stat",
    "git -C src log --oneline",
    "git diff -- src/app/page.tsx",
    "git diff HEAD~1",
    "git log origin/develop..HEAD --oneline",
  ])("allows: %s", (cmd) => expect(check(cmd)).toBe(0));

  test.each([
    ["write via --output", "git diff --output=out.txt"],
    ["write via abbreviated --out", "git diff --out=out.txt"],
    ["write via --o prefix", "git log --o=x"],
    ["external diff program", "git diff --ext-diff"],
    ["textconv", "git show --textconv HEAD"],
    ["read outside repo", "git diff --no-index a b"],
    ["git -c config injection", "git -c core.pager=calc diff"],
    ["--git-dir", "git --git-dir=/x diff"],
    ["-C outside project", "git -C .. diff"],
    ["-C absolute elsewhere", "git -C C:/Windows diff"],
    ["-C without path", "git -C"],
    ["-C home expansion", "git -C ~ log -p"],
    ["-C wildcard that expands to ..", "git -C [.][.]/other status"],
    ["-C star", "git -C * status"],
    ["orderfile reads arbitrary file", "git diff -O/etc/passwd"],
    ["signature program from config", "git log --show-signature"],
    ["home expansion in args", "git diff ~/x"],
    ["reads exclude file outside repo", "git ls-files --exclude-from=/etc/hosts"],
    ["push", "git push origin main"],
    ["commit", "git commit -m x"],
    ["checkout", "git checkout main"],
    ["reset", "git reset --hard"],
    ["branch delete", "git branch -D x"],
    ["lookalike subcommand", "git diffstat"],
    ["chaining", "git diff; rm -rf x"],
    ["and-chain", "git diff && npm i"],
    ["pipe", "git log | sh"],
    ["substitution", "git show $(whoami)"],
    ["backtick", "git show `whoami`"],
    ["redirect", "git diff > out.txt"],
    ["quotes", 'git log --format="%h"'],
    ["newline", "git diff\nrm x"],
    ["npm in git profile", "npm audit"],
    ["rm", "rm -rf node_modules"],
    ["empty", ""],
  ])("blocks: %s", (_n, cmd) => expect(check(cmd)).toBe(2));

  describe("-C filesystem checks (temporary project)", () => {
    let proj, outside;
    beforeAll(() => {
      proj = mkdtempSync(join(tmpdir(), "devtrack-ro-proj-"));
      outside = mkdtempSync(join(tmpdir(), "devtrack-ro-out-"));
      mkdirSync(join(proj, "src"));
      mkdirSync(join(proj, "vendor", "sub", ".git"), { recursive: true }); // nested repository
      try {
        symlinkSync(outside, join(proj, "link"), "junction"); // junction works without admin on Windows
      } catch {
        // symlink creation not permitted on this machine; the test below skips itself
      }
    });
    afterAll(() => {
      rmSync(proj, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });
    const inProj = (cmd) =>
      run("readonly-bash.mjs", { tool_input: { command: cmd }, cwd: proj }, { env: { CLAUDE_PROJECT_DIR: proj }, argv: ["git"] }).status;

    test("allows a plain subdirectory", () => expect(inProj("git -C src status")).toBe(0));
    test("blocks a nested repository (its .git/config could run programs)", () =>
      expect(inProj("git -C vendor/sub status")).toBe(2));
    test("blocks a symlink/junction that leaves the project", (ctx) => {
      if (!existsSync(join(proj, "link"))) ctx.skip(); // visible skip: link creation not permitted on this machine
      expect(inProj("git -C link status")).toBe(2);
    });
  });

  test.skipIf(process.platform !== "win32")("-C inside the project accepts a Git Bash style absolute path", () => {
    const abs = repo.replace(/^([A-Za-z]):/, (_m, d) => `/${d.toLowerCase()}`).replace(/\\/g, "/");
    expect(check(`git -C ${abs}/src diff`)).toBe(0);
  });

  describe("git-audit profile", () => {
    test.each([
      "npm audit",
      "npm audit --omit=dev",
      "npm audit --json",
      "npm audit --audit-level=high",
      "npm ls",
      "npm ls next",
      "npm ls @types/node --depth=0",
      "git diff",
    ])("allows: %s", (cmd) => expect(check(cmd, "git-audit")).toBe(0));
    test.each([
      "npm audit fix",
      "npm audit fix --force",
      "npm audit signatures",
      "npm install left-pad",
      "npm ci",
      "npm run build",
      "npm audit --prefix=/x",
      "npm ls --prefix=/x",
      "npm ls -C /other/project", // -C is npm's short form of --prefix
      "npm ls --pref=/x", // npm resolves option abbreviations
      "npm audit --userconfig=/x",
      "npm audit --globalconfig=/x",
      "npm audit --registry=https://registry.example.invalid",
      "npm audit --audit-level=high extra",
      "npm ls ../other",
    ])("blocks: %s", (cmd) => expect(check(cmd, "git-audit")).toBe(2));
  });
});

// Builds a throwaway project whose eslint/tsc/next are stubs driven by env vars.
function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "devtrack-hooktest-"));
  const stub = (rel, body) => {
    const f = join(dir, "node_modules", ...rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, body);
  };
  const body = (name) => `
    const ms = Number(process.env.STUB_${name}_SLEEP_MS || 0);
    if (ms) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    const code = Number(process.env.STUB_${name}_EXIT || 0);
    if (code) console.log("${name.toLowerCase()} stub failure");
    process.exit(code);
  `;
  stub(["eslint", "bin", "eslint.js"], body("ESLINT"));
  stub(["typescript", "bin", "tsc"], body("TSC"));
  stub(["next", "dist", "bin", "next"], body("NEXT"));
  writeFileSync(join(dir, ".gitignore"), "node_modules\n");
  spawnSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}
const stampFor = (dir) =>
  join(tmpdir(), `devtrack-verified-${createHash("sha1").update(dir).digest("hex").slice(0, 8)}`);

describe("lint-edited", () => {
  let dir;
  beforeAll(() => {
    dir = makeProject();
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\n");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const lint = (file, env = {}) =>
    run("lint-edited.mjs", { tool_input: { file_path: file } }, { env: { CLAUDE_PROJECT_DIR: dir, ...env } });

  test("clean file passes silently", () => {
    const r = lint("src/a.ts");
    expect([r.status, r.stderr]).toEqual([0, ""]);
  });
  test("lint findings (exit 1) are reported as problems", () => {
    const r = lint("src/a.ts", { STUB_ESLINT_EXIT: "1" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/found problems/);
  });
  test("fatal/config error (exit 2) is reported as a failure to run, not as lint findings", () => {
    const r = lint("src/a.ts", { STUB_ESLINT_EXIT: "2" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/failed to run/);
    expect(r.stderr).toMatch(/configuration or fatal/);
  });
  test("timeout is reported, not silently passed", () => {
    const r = lint("src/a.ts", { STUB_ESLINT_SLEEP_MS: "5000", DEVTRACK_HOOK_TIMEOUT_MS: "400" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/could not finish/);
  });
  test("non-JS, missing and malformed inputs are skipped", () => {
    expect(lint("README.md", { STUB_ESLINT_EXIT: "1" }).status).toBe(0);
    expect(lint("src/missing.ts", { STUB_ESLINT_EXIT: "1" }).status).toBe(0);
    expect(run("lint-edited.mjs", null, { raw: "garbage" }).status).toBe(0);
  });
  test("lints .mts/.cts/.cjs files too", () => {
    writeFileSync(join(dir, "src", "b.mts"), "export {};\n");
    expect(lint("src/b.mts", { STUB_ESLINT_EXIT: "1" }).status).toBe(2);
  });
});

describe("verify-on-stop", () => {
  let dir;
  beforeAll(() => (dir = makeProject()));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(stampFor(dir), { force: true });
  });
  const stop = (env = {}, payload = {}) =>
    run("verify-on-stop.mjs", payload, { env: { CLAUDE_PROJECT_DIR: dir, ...env } });
  const warned = (r) => r.status === 0 && r.stdout.includes("systemMessage");

  test("silent when no source files changed", () => {
    const r = stop({ STUB_TSC_EXIT: "1" });
    expect([r.status, r.stdout]).toEqual([0, ""]);
  });

  test("detects an untracked file inside a NEW directory and warns on failure (never blocks)", () => {
    mkdirSync(join(dir, "src", "feature"), { recursive: true });
    writeFileSync(join(dir, "src", "feature", "a.ts"), "export const a = 1;\n");
    const r = stop({ STUB_TSC_EXIT: "1" });
    expect(warned(r)).toBe(true);
    expect(r.stdout).toMatch(/typecheck failed/);
    expect(JSON.parse(r.stdout)).not.toHaveProperty("decision");
  });

  test("reports each failing step", () => {
    const r = stop({ STUB_NEXT_EXIT: "1", STUB_ESLINT_EXIT: "1" });
    expect(r.stdout).toMatch(/typegen failed/);
    expect(r.stdout).toMatch(/lint failed/);
  });

  test("passing run writes a stamp; unchanged tree is then skipped even if checks would now fail", () => {
    expect(stop().stdout).toBe("");
    expect(existsSync(stampFor(dir))).toBe(true);
    expect(stop({ STUB_TSC_EXIT: "1" }).stdout).toBe(""); // skipped via fingerprint
  });

  test("editing an UNTRACKED file invalidates the stamp", () => {
    // Guard against passing vacuously: a stamp must exist (from the previous test) before the edit.
    expect(existsSync(stampFor(dir))).toBe(true);
    writeFileSync(join(dir, "src", "feature", "a.ts"), "export const a = 12345;\n");
    expect(warned(stop({ STUB_TSC_EXIT: "1" }))).toBe(true);
  });

  test("a hung step is cut off within the shared time budget and reported", () => {
    writeFileSync(join(dir, "src", "feature", "a.ts"), "export const a = 999999;\n");
    const r = stop({ STUB_NEXT_SLEEP_MS: "8000", STUB_TSC_SLEEP_MS: "8000", DEVTRACK_HOOK_TIMEOUT_MS: "600" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/timed out|skipped/);
    expect(r.ms).toBeLessThan(6000);
  });

  test("stop_hook_active and malformed input are ignored", () => {
    writeFileSync(join(dir, "src", "feature", "a.ts"), "export const a = 7;\n");
    expect(stop({ STUB_TSC_EXIT: "1" }, { stop_hook_active: true }).stdout).toBe("");
    expect(run("verify-on-stop.mjs", null, { raw: "garbage" }).status).toBe(0);
  });
});

describe("settings.json permissions and hook wiring", () => {
  const settings = JSON.parse(readFileSync(join(repo, ".claude", "settings.json"), "utf8"));
  const denyPaths = (tool) =>
    settings.permissions.deny.filter((d) => d.startsWith(`${tool}(`) && !d.startsWith("Bash(")).map((d) => d.slice(tool.length + 1, -1));
  const covered = (tool, file) => denyPaths(tool).some((g) => matchesGlob(file, g) || matchesGlob(file, g.replace(/^\*\*\//, "")));

  test.each(["Read", "Edit"])("%s deny rules cover dotenv variants at any depth", (tool) => {
    for (const f of [E, `${E}.local`, `${E}.production`, `${E}.development`, `${E}.test`, `${E}.staging`, `${E}.staging.local`, `app/${E}`, `a/b/${E}.local`]) {
      expect(covered(tool, f), `${tool} should deny ${f}`).toBe(true);
    }
  });

  test.each(["Read", "Edit"])("%s deny rules never match example files", (tool) => {
    for (const f of [`${E}.example`, `${E}.sample`, `${E}.template`, `app/${E}.example`]) {
      expect(covered(tool, f), `${tool} must allow ${f}`).toBe(false);
    }
  });

  test("credentials and key files are denied", () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(["Read(~/.claude/.credentials.json)", "Read(**/*.pem)", "Read(**/id_rsa)", "Edit(**/id_rsa)"]),
    );
  });

  test("more credential files are denied", () => {
    const deny = settings.permissions.deny;
    for (const p of ["**/.npmrc", "**/.netrc", "**/.git-credentials", "**/*.key", "**/*.pfx", "**/*.p12", "**/id_ecdsa", "~/.aws/**"]) {
      expect(deny, `Read(${p})`).toContain(`Read(${p})`);
    }
  });

  test("destructive Bash commands stay denied, including -C forms", () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        "Bash(git reset --hard *)",
        "Bash(npm publish *)",
        "Bash(npm publish)",
        "Bash(git -C * reset --hard*)",
        "Bash(git clean *)",
        "Bash(git branch -D *)",
        "Bash(git stash clear)",
      ]),
    );
  });

  test("every git push is denied by plain rules; no piecemeal or legacy-suffix push rules remain", () => {
    const pushRules = settings.permissions.deny.filter((d) => /\bpush\b/.test(d));
    expect(pushRules.sort()).toEqual(["Bash(git push *)", "Bash(git push)"]);
  });

  test("no Bash permission rule uses a trailing `:*` (Claude Code reads it as the legacy prefix syntax)", () => {
    const all = [...settings.permissions.allow, ...settings.permissions.deny, ...(settings.permissions.ask ?? [])];
    for (const r of all.filter((x) => x.startsWith("Bash("))) {
      expect(r, `${r} ends with :*`).not.toMatch(/:\*\)$/);
    }
  });

  test("the git push hook is registered for Bash and PowerShell", () => {
    const entry = settings.hooks.PreToolUse.find((h) => h.hooks.some((x) => x.command.includes("block-git-push.mjs")));
    expect(entry?.matcher.split("|")).toEqual(expect.arrayContaining(["Bash", "PowerShell"]));
  });

  test("abbreviated git/npm/vitest option spellings are denied too", () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        "Bash(git * --ou*)",
        "Bash(git * --ext*)",
        "Bash(git * -O*)",
        "Bash(npx vitest --config*)",
        "Bash(npx vitest -c *)",
        "Bash(npm run lint -- *--config*)",
        "Bash(npm --script-shell*)",
      ]),
    );
  });

  test("file-writing / program-running git and npm options are denied even under allowed commands", () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(["Bash(git * --output*)", "Bash(git * --ext-diff*)", "Bash(git * --no-index*)", "Bash(npx vitest * --config*)", "Bash(npm * --script-shell*)"]),
    );
  });

  test("allow list stays narrow (no blanket Bash, write-capable git or branch deletion)", () => {
    for (const a of settings.permissions.allow) {
      expect(a).not.toMatch(/^Bash(\(\*\))?$/);
      expect(a).not.toMatch(/git (push|commit|checkout|reset|rebase|clean|add|branch \*)/);
    }
    expect(settings.permissions.allow).toContain("Bash(git branch --list *)");
  });

  test("npm lint/test/typecheck/build are allowed only as exact commands, so no arguments (e.g. --config) pass through", () => {
    const allow = settings.permissions.allow;
    expect(allow).toEqual(
      expect.arrayContaining(["Bash(npm run lint)", "Bash(npm run typecheck)", "Bash(npm test)", "Bash(npm run test)", "Bash(npm run build)"]),
    );
    // No wildcard (or `:*`) on any npm allow rule: `npm test -- --config evil.mjs` and `npm run lint -- -c x`
    // must fall through to a prompt instead of loading attacker-chosen config.
    for (const rule of allow.filter((r) => /^Bash\(npm\b/.test(r))) expect(rule, rule).not.toContain("*");
    // The only wildcarded script runner is vitest itself, whose config-loading flags are denied below.
    expect(allow.filter((r) => /^Bash\(np[mx]\b/.test(r) && r.includes("*"))).toEqual(["Bash(npx vitest *)"]);
  });

  test("project skills never allow npm/npx commands with free-form arguments (except vitest)", () => {
    const skills = readdirSync(join(repo, ".claude", "skills"));
    expect(skills.length).toBeGreaterThan(0);
    for (const name of skills) {
      const skill = readFileSync(join(repo, ".claude", "skills", name, "SKILL.md"), "utf8");
      const tools = /^allowed-tools:[ \t]*(.*)$/m.exec(skill)?.[1];
      if (tools === undefined) continue; // the skill does not pre-approve any tool
      expect(tools.trim(), `${name}: allowed-tools must be a non-empty single line`).not.toBe("");
      for (const rule of tools.match(/Bash\([^)]*\)/g) ?? []) {
        if (/^Bash\(np[mx]\b/.test(rule) && rule.includes("*")) expect(rule, name).toBe("Bash(npx vitest *)");
      }
    }
  });

  test("changes to the guardrails themselves require human confirmation", () => {
    // Includes files that auto-allowed commands execute (npm scripts, vitest/eslint configs, git hooks).
    for (const p of [".claude/hooks/**", ".claude/settings.json", ".claude/settings.local.json", ".claude/agents/**", ".claude/skills/**", "package.json", "vitest.config.*", "eslint.config.*", ".git/hooks/**", ".git/config"]) {
      expect(settings.permissions.ask, `Edit(${p})`).toContain(`Edit(${p})`);
    }
  });

  test("secret guard covers every file-reaching tool", () => {
    const matcher = settings.hooks.PreToolUse.find((h) => h.hooks.some((x) => x.command.includes("protect-secrets"))).matcher;
    for (const t of ["Read", "Edit", "Write", "NotebookEdit", "Bash", "PowerShell", "Grep", "Glob"]) expect(matcher.split("|")).toContain(t);
  });

  test("Stop hook budget fits inside its configured timeout", () => {
    const stopHook = settings.hooks.Stop[0].hooks[0];
    const src = readFileSync(hook("verify-on-stop.mjs"), "utf8");
    const m = /\|\| (\d[\d_]*); \/\/ total/.exec(src);
    expect(m, "BUDGET_MS declaration not found in verify-on-stop.mjs (did its format change?)").not.toBeNull();
    const budget = Number(m[1].replace(/_/g, ""));
    expect(budget).toBeLessThan(stopHook.timeout * 1000);
  });

  test("every referenced hook script exists", () => {
    const cmds = JSON.stringify(settings.hooks).match(/hooks\/[\w-]+\.mjs/g) ?? [];
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) expect(existsSync(join(repo, ".claude", c))).toBe(true);
  });
});

describe("read-only subagents", () => {
  const front = (name) => readFileSync(join(repo, ".claude", "agents", `${name}.md`), "utf8").split("---")[1];
  test.each(["code-reviewer", "security-auditor", "architecture-analyst"])("%s has no write tools and the Bash guard", (name) => {
    const f = front(name);
    const tools = /^tools: (.*)$/m.exec(f)[1];
    expect(tools).not.toMatch(/\b(Edit|Write|NotebookEdit)\b/);
    expect(f).toMatch(/readonly-bash\.mjs/);
  });
  test("security-auditor uses the audit profile, others the plain git profile", () => {
    expect(front("security-auditor")).toMatch(/readonly-bash\.mjs\\?" git-audit/);
    expect(front("code-reviewer")).toMatch(/readonly-bash\.mjs\\?" git"/);
  });
});
