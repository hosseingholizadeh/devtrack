---
name: verify
description: Run the full DevTrack verification pipeline (lint, typecheck, unit tests, production build) and report pass/fail per step. Use before declaring work done, before committing, or before opening a PR.
allowed-tools: Bash(npm run lint) Bash(npm run typecheck) Bash(npm test) Bash(npm run build)
---

# Verify

Run these in order, each as its own command. Do not stop at the first failure: run every step so the report is complete.

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## Report

Give a table with one row per step: pass/fail, and for failures the first relevant error lines (file:line and message), not the full log.

Then, if anything failed, state the likely cause and propose a fix. Do not claim work is done unless all four steps passed. If a step could not run, say so explicitly instead of marking it passed.

Never fix failures by weakening checks (disabling lint rules, loosening tsconfig, skipping or deleting tests) unless the user asks.
