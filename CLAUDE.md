# CLAUDE.md — LingoLearn AI Assistant Guide

This file is loaded automatically by Claude Code at the start of every session. Read it before writing any code.

---

## Project overview

LingoLearn is an AI-powered language learning platform built with SvelteKit 5 + TypeScript + Prisma + PostgreSQL. Users learn German, Spanish, and French through spaced-repetition flashcards, AI-generated lessons, AI conversation, and classroom tools.

## Stack

- **Framework**: SvelteKit 2, Svelte 5 (runes: `$state`, `$derived`, `$props`, `$effect`)
- **Database**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`)
- **Auth**: `@auth/sveltekit` — Google OAuth + local credentials (bcrypt)
- **AI**: OpenAI SDK pointing at any OpenAI-compatible endpoint
- **Package manager**: pnpm (always use pnpm, never npm or yarn)
- **Styling**: Plain CSS with CSS custom properties for theming (no Tailwind)

## Directory structure

```
src/
  routes/           SvelteKit pages and API routes
    api/            Server-only API endpoints (+server.ts)
  lib/
    components/     Svelte components
    server/         Server-only utilities — NEVER import these in client code
    utils/          Client-safe utilities
  hooks.server.ts   Auth + authorization + rate limiting middleware
  auth.ts           Auth.js config
prisma/
  schema.prisma     Database schema — source of truth
```

## Svelte 5 conventions

All files use Svelte 5 runes. Do NOT use Svelte 4 patterns:

| Svelte 4 (avoid)          | Svelte 5 (use instead)            |
| ------------------------- | --------------------------------- |
| `export let data`         | `let { data } = $props()`         |
| `$: derived = expr`       | `let derived = $derived(expr)`    |
| `$: { sideEffect() }`     | `$effect(() => { sideEffect() })` |
| `<script>` without `lang` | `<script lang="ts">`              |

## Key architectural rules

- `src/lib/server/` files are **server-only** — never import them from `.svelte` components or client-side code
- All API routes enforce `Content-Type: application/json` on POST/PUT/PATCH (enforced in `hooks.server.ts`)
- Auth session is in `event.locals.user` on the server — never trust client-sent user IDs
- LLM API keys (`llmBaseUrl`, `llmApiKey`) are intentionally excluded from `locals.user` — they must never reach the client
- Rate limiting is applied globally in `hooks.server.ts`
- The SRS flow: `UNSEEN → LEARNING → KNOWN → MASTERED`

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/). See `CONTRIBUTING.md` for the full table and release process.

```
feat:      new user-facing feature           → minor bump
fix:       bug fix                           → patch bump
perf:      performance, no API change        → patch bump
refactor:  internal restructure              → patch bump (rarely worth releasing alone)
style:     CSS/UI only, no logic change      → patch bump
test:      tests only                        → skip release
docs:      documentation only               → skip release
chore:     deps, config                      → skip release
ci:        CI/CD                             → skip release
feat!:     breaking change                   → major bump
```

**Never commit directly.** Stage changes for the user to review first.

## Release process (short version)

```bash
pnpm test && pnpm check && pnpm lint   # must all pass
pnpm run release:minor                 # or patch / major
```

Full details in `CONTRIBUTING.md`.

## Testing

- Unit tests: `pnpm test` (Vitest, `tests/unit/`)
- E2E tests: `pnpm test:e2e` (Playwright, requires running app + real DB)
- Type check: `pnpm check`
- Lint: `pnpm lint`

Run `pnpm test && pnpm check && pnpm lint` before any release.
