// @vitest-environment node
// Tests for the Claude Code guardrail hooks and the permission rules in .claude/settings.json.
// Hooks are exercised exactly as Claude Code runs them: a node process fed JSON on stdin.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, matchesGlob } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const hook = (name) => join(here, name);
const E = "." + "env"; // dotenv file name, built so this file is easy to grep without noise

function run(script, payload, { env = {}, argv = [], raw } = {}) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [hook(script), ...argv], {
    input: raw ?? JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo, ...env },
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

  test("destructive Bash commands stay denied, including reordered and -C forms", () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        "Bash(git push --force *)",
        "Bash(git push -f *)",
        "Bash(git reset --hard *)",
        "Bash(npm publish *)",
        "Bash(npm publish)",
        "Bash(git push *--force*)",
        "Bash(git push * -f)",
        "Bash(git push * -f *)",
        "Bash(git push *--delete*)",
        "Bash(git -C * push *)",
        "Bash(git -C * reset --hard*)",
        "Bash(git clean *)",
        "Bash(git push *+*)",
        "Bash(git push * :*)",
        "Bash(git -c * push *)",
        "Bash(git branch -D *)",
        "Bash(git stash clear)",
      ]),
    );
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
