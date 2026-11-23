---
name: debug
description: Systematically diagnose and fix a failing test, build error or runtime bug in DevTrack by delegating to the debugger subagent, then verify. Use when something is broken and the cause is unclear.
argument-hint: "[error message, failing test or symptom]"
allowed-tools: Bash(npm test *) Bash(npm run typecheck) Bash(npm run lint)
---

# Debug

Problem: `$ARGUMENTS`

1. If no problem was given, run `npm run lint`, `npm run typecheck` and `npm test` to find a failure; if all pass, report that and stop.
2. Delegate to the `debugger` subagent with the exact symptom, the command that reproduces it, and any recent changes (`git status`, `git log -5 --oneline`). Ask it to return root cause, files changed and verification output.
3. Independently confirm: re-run the reproducing command and `npm test`. Do not rely on the subagent's claim alone.
4. Report: root cause, fix, regression test added (or why not), verification results. If the fix required a design decision, present options instead of picking one.
