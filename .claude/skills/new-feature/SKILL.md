---
name: new-feature
description: Implement a DevTrack feature end to end - plan, implement, test, verify - following project conventions and the bundled Next.js docs. Use when starting scoped feature work on a feature branch.
argument-hint: "[feature description]"
disable-model-invocation: true
---

# New feature

Feature: `$ARGUMENTS`

1. **Branch check.** Run `git branch --show-current`. Never work on `main` or `develop`; if on one, create `feat/<short-name>` from `develop` first.
2. **Read the docs.** Identify the Next.js 16 features involved and read the matching guides in `node_modules/next/dist/docs/` before writing code.
3. **Plan.** For anything structural, ask the `architecture-analyst` subagent for a fit assessment first. State a short plan (files, components, server/client split, tests). Stop and ask the user if requirements are ambiguous.
4. **Implement** the smallest change that satisfies the request. No unrelated refactors.
5. **Test.** Delegate test writing to the `test-writer` subagent (or write tests yourself for trivial code). Server Components that are `async` need E2E, not Vitest: flag them.
6. **Verify.** Run `/verify`. Fix failures at the root cause; never weaken checks.
7. **Review.** Run `/review-pr` before reporting completion on non-trivial changes.
8. **Report** what changed, test coverage, verification results and open questions. Do not commit or push unless asked.
