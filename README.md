# DevTrack

A lightweight project tracker for developers. Create projects, set start and due dates, and track
status (Active, Completed, Archived).

DevTrack is also a worked example of building software with an AI coding agent (Claude Code) while
keeping engineering standards: tests, CI, pull requests, and guardrails on what the agent may do.

<!-- Add a screenshot of the projects list here, for example: ![Projects list](docs/projects.png) -->

**Status:** in active development.

## What works today

- Create, view, edit and delete projects.
- Project status (Active, Completed, Archived) and optional start and due dates.
- Server-side validation (Zod) plus database constraints: the name cannot be blank, and the due date
  cannot be before the start date.
- Loading, error and not-found states for the project pages.

## Planned

Task management, project dashboards, search and filtering, progress tracking, authentication.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, PostgreSQL with Drizzle ORM and
node-postgres, Zod, Vitest, and GitHub Actions.

## Run locally

Requires Node 24 (see `.nvmrc`) and a PostgreSQL database (local, or the free tier on
[Neon](https://neon.tech)).

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL
npm run db:migrate
npm run dev                  # http://localhost:3000
```

For a local PostgreSQL server without SSL, add `sslmode=disable` to the connection string.

After changing `src/features/*/schema.ts`, run `npm run db:generate`, review the SQL in `drizzle/`, and
commit it.

## Tests and checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- Repository and action tests run against in-memory PGlite using the real migrations, so they need no
  database.
- Set `TEST_DATABASE_URL` (see `.env.example`) to also run the migration test against a real PostgreSQL.
  That database is wiped, so its name must end in `_test`.
- Component tests use Testing Library. The Claude Code hooks have their own tests and run with
  `npm test`.

## CI

GitHub Actions runs lint, typecheck, tests and build on pull requests to `main` and `develop` and on
pushes to those branches. The tests run against a PostgreSQL 17 service container, so the migration test
runs against a real database. Pushes to other branches get a build check only.

## How it is built: AI-assisted, with guardrails

I use Claude Code for scaffolding, refactoring, tests and review, with limits that are written down and
tested in this repository (`.claude/`, `CLAUDE.md`, `AGENTS.md`):

- **No pushes by the agent.** A hook parses commands and blocks `git push`, including variations such as
  aliases and global options. Permission rules deny it too. I run pushes myself. The hooks have their
  own tests.
- **Secrets are protected.** `.env` files and credentials are denied by permission rules and by a hook,
  so the agent cannot read them.
- **Edits are checked.** After each file edit, a hook lints the changed file and feeds errors back. When a
  turn ends, a warn-only hook runs typecheck and lint on changed sources.
- **Restricted command surface.** Only a short list of commands (lint, typecheck, tests, build, read-only
  git) runs without asking. Read-only review subagents are limited to read-only commands.
- **Changes go through pull requests.** Branch from `develop`, open a PR, and CI must pass. Review
  subagents (code review, security audit, test writing, debugging, architecture analysis) and a
  `/verify` skill support this. I review the findings and decide what is fixed.

Neither the permission rules nor the hooks are a sandbox. They reduce risk and keep the agent inside the
workflow. They do not replace reviewing its work.

## License

MIT. See [LICENSE](LICENSE).
