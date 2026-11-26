# DevTrack

A lightweight project tracker for developers: create projects, set start and due
dates, and track status (Active, Completed, Archived).

It is also a working example of how I build software with AI coding agents while
keeping engineering standards: tests, CI, branch-based workflow and human review.

**Status:** in active development. [Screenshot here]

## What works today
- [Project create / edit / archive]
- [Status tracking, start and due dates]
- [Anything else that is actually implemented]

## Planned
Task management, project dashboards, search and filtering, progress tracking.

## Tech stack
Next.js, TypeScript, PostgreSQL, Drizzle ORM, Vitest, GitHub Actions.

## Run locally
1. [Node version from .nvmrc]
2. [Install: npm install]
3. [Database setup and environment variables]
4. [npm run dev -> http://localhost:3000]
5. [Run tests: npm test]

## How it is built (AI-assisted, with guardrails)
- Claude Code does scaffolding, refactoring, tests and review, but never pushes:
  a hook blocks `git push`, and permission rules limit what commands it may run.
- Every change goes through a pull request with a template and CI checks
  (typecheck, lint, tests).
- Review findings from Claude Code are fixed in follow-up PRs, with a human
  deciding what merges.
- Agent instructions live in `CLAUDE.md` and `AGENTS.md`.

## Architecture
[One diagram or short paragraph: pages and API routes, Drizzle schema,
PostgreSQL, how tests are organised.]

## License
MIT
