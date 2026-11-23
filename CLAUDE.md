# DevTrack

@AGENTS.md

Next.js 16 (App Router) + React 19 + Tailwind 4 + strict TypeScript. Source lives in `src/` (alias `@/*` → `src/*`).

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` (single run) · `npm run test:watch` |
| Production build | `npm run build` |
| Full verification | `/verify` (lint → typecheck → test → build) |

## Node version

- Supported: `^22.12.0 || ^24.0.0 || >=26.0.0` (`engines` in package.json). This is Vitest 5's range, and it excludes Node 25. CI and `.nvmrc` use Node 24.
- `@types/node` is pinned to `^24` to match the CI/`.nvmrc` runtime. Vitest 5 and Vite 8 need `@types/node` ≥ 22, so the scaffold's `^20` could not be installed.
- Claude Code hooks (`.claude/hooks/*.mjs`) are plain Node scripts, so they work on Windows without a POSIX shell. Their tests run with `npm test`.

## Conventions

- Next.js 16 differs from older versions. Read the matching guide in `node_modules/next/dist/docs/` before writing Next.js code (see AGENTS.md).
- Vitest cannot unit-test `async` Server Components; cover those with E2E tests instead.
- Tests live next to the code as `*.test.ts(x)`.
- Keep changes scoped to the task. No drive-by refactors.
- Never read, print or commit `.env*` files or credentials.
- Dependency changes (`package.json` / `package-lock.json`) are fine when deliberate: state why, then run `/verify`.

## Git workflow

- Branch from `develop` (`feat/…`, `fix/…`, `chore/…`). Never commit directly to `main` or `develop`.
- Open PRs against `develop`. CI must pass (lint, typecheck, test, build).

## Definition of done

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass, and new behaviour has tests.

## Claude Code setup

- Project config is in `.claude/` (settings, hooks, skills, agents). Personal overrides go in `.claude/settings.local.json` (gitignored).
- MCP is intentionally disabled. Add a server only for a concrete need.
