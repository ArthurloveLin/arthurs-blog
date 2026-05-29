# AGENT.md

Shared project conventions for all AI agents. Load this file into context at the start of any session — paste it, @-reference it, or include it however your tool supports.

---

## Project Overview

Personal blog + wardrobe management app. Next.js 16 (`viewTransition` experimental enabled), React 19, TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + Auth), Cloudflare R2 for file storage. Deployed as a standalone Docker image.

---

## High-Blast-Radius Zones

Name which of these your task will touch **before writing a single line**:

- `engagement-worker` — sole write path for all comments, reactions, emoji
- `MemoBoardShell` — shared shell for both `/memo` and `/guestbook`
- `SiteDataProvider` / `app/layout.tsx` — feeds every page's sidebar data
- `lib/cloudflare-cache.ts` — must be called after mutations that have CDN cache headers

When scope is ambiguous (especially data-layer or worker changes), ask rather than assume.

---

## Application Routes

| Route | Purpose |
|---|---|
| `/blog`, `/category`, `/tag`, `/archive`, `/search` | Blog reading |
| `/wardrobe`, `/session` | Wardrobe session management |
| `/recipe` | Recipe collection (admin-editable) |
| `/memo`, `/guestbook` | Note boards & guestbook |
| `/spotify` | Spotify listening history & stats |
| `/trend-radar` | Trending topics from R2-stored data |
| `/now-watching` | Movie/TV watch log |
| `/life-gallery` | Photo gallery from R2 |
| `/admin` | Admin-only dashboard |

---

## Data Layer

- **Blog posts**: Markdown files in R2, metadata indexed in Supabase via `/api/blog/reindex`. `lib/blog.ts` handles all queries with `unstable_cache` tag-based caching.
- **Wardrobe/Sessions**: Fully in Supabase. Items belong to sessions, have categories, multi-dimension ratings, notes, price. Supabase Realtime used for live updates (`RealtimeSync.tsx`). Images uploaded as WebP to R2 under `{sessionToken}/{itemId}.webp`.
- **Recipes**: Stored in Supabase with versioning/revision snapshots. `lib/recipes.ts` handles CRUD, revision history, ingredient/step management.
- **Comments & Reactions**: Routed through the `engagement-worker`. The Next.js app **never writes comments directly to Supabase** — proxies via `lib/engagement-public-api.ts` → worker. `lib/comments-server.ts` reads comment threads server-side.
- **Note Boards / Guestbook**: Notes stored in Supabase `comments` table with `target_type`/`target_id`. Board configs in `lib/note-board-config.ts`.
- **Spotify**: Listening data stored as JSON shards in R2 (`spotify/` prefix). `lib/spotify.ts` reads server-side. `cloudflare-worker` handles OAuth token refresh and data sync.
- **Trend Radar**: Aggregated trending data in R2 (`trend-radar/` prefix), read by `lib/trend-radar.ts`.
- **Now Watching**: Poster images and metadata JSON in R2 (`now-watching/` prefix), read by `lib/now-watching.ts`.
- **Life Gallery**: Images in R2 under `Gallery/` prefix, organized by theme folders. Read by `lib/life-gallery.ts`.
- **Analytics**: Self-hosted Umami. Server-side queries via `lib/umami.ts`.

---

## Auth & Roles

Three-tier: guest → user → admin. Guests use a token in localStorage (`lib/guest.ts`). Authenticated users go through Supabase Auth (SSR cookies via `lib/supabase-server.ts`). Admin role resolved from `user_roles` table in `lib/auth.ts`. Client-side uses anon key (`lib/supabase-client.ts`); service role key only server-side (`lib/supabase-admin.ts`).

---

## Cloudflare Workers

Six workers in `workers/`, each independently deployable:

| Worker | Purpose |
|---|---|
| `engagement-worker` | All comment writes (rate limiting via DO, direct Supabase insert), comment thread cache, ntfy notifications |
| `cloudflare-worker` | Spotify data sync (OAuth, library/history snapshots to R2), public Spotify data API |
| `spotify-now-playing-worker` | Lightweight now-playing endpoint (cached) |
| `genius-worker` | Genius API proxy for lyrics/song metadata |
| `spotify-image-proxy` | Spotify artwork proxy (CORS + caching) |
| `wardrobe-supabase-worker` | Wardrobe data proxy to Supabase |

Next.js app communicates with `engagement-worker` via `NEXT_PUBLIC_ENGAGEMENT_WORKER_URL`. Comment reads can bypass the worker; writes always go through it.

---

## Key Patterns

- Server Components by default; `'use client'` only where needed.
- Root layout (`app/layout.tsx`) fetches blog sidebar data server-side and distributes via `SiteDataProvider` / `useSiteData` hook.
- Auth state distributed via `AuthProvider` (`useAuth` hook).
- Spotify now-playing via `SpotifyProvider`.
- Cloudflare cache purging after mutations: `lib/cloudflare-cache.ts` calls the CF Zones API to purge by URL.
- `viewTransition: true` in `next.config.ts` enables React View Transitions API; `DirectionalTransition.tsx` wraps navigation for slide animations.
- Anti-bot protection on comment/note submission via Cloudflare Turnstile (`lib/turnstile.ts`, `components/Turnstile.tsx`).
- OCR for wardrobe item import via Baidu OCR API (`lib/item-ocr.ts`).
- Blog full-text search is client-side via `lib/blog-search.ts`.

---

## Storage

- R2 blog bucket: markdown posts, blog images, Spotify data shards, trend radar data, now-watching posters, life gallery images
- R2 wardrobe bucket: session-namespaced item images
- Public CDN domains: `images.arthurlovegrace.top` (wardrobe), `obsidian.arthurlovegrace.top` (blog)

---

## CDN Cache Headers (next.config.ts)

| Path | Cache |
|---|---|
| `/memo`, `/guestbook` | `s-maxage=120, stale-while-revalidate=3600` |
| `/wardrobe` | `no-store` |
| `/recipe/*` | `s-maxage=3600, stale-while-revalidate=86400` |
| `/blog/:path*` | Next.js ISR default (`s-maxage=31536000`) |
| Homepage | 1h |

---

## Coding Conventions

### Think Before Coding

Before implementing, **state your interpretation** if a request could be read multiple ways. Don't pick silently — present the options and confirm.

Name any shared infrastructure your change will touch (see High-Blast-Radius Zones above).

### Multi-Step Tasks

For non-trivial tasks, state a brief plan before starting:

```
1. [step] → verify: [check]
2. [step] → verify: [check]
```

No test suite exists — type-check + lint is the only automated safety net. Run the check that matches the change scope:

| Level | When | Command |
|---|---|---|
| **File** | Pure markup / style / comment change; no type-surface touched | `npx eslint <file>` |
| **App** | Logic or type changes in `app/`, `components/`, `lib/` | `tsc --noEmit && npm run lint` |
| **Workers** | Changes only inside `workers/` | `npm run check:workers` |
| **Full** | Cross-cutting: shared types, `lib/` consumed by workers, config | `npm run check` |

When in doubt, go one level up. If a "File" change touches an exported type, treat it as **App**.

### Shared Code

When modifying a shared component, call it out explicitly. Don't silently refactor adjacent code — mention unrelated issues instead of fixing them in the same change.

---

## Git Policy

> **HARD RULE — no exceptions:** Never run `git push` unless the user's message contains an explicit instruction to push (e.g., "推送", "push", "提交推送"). Finishing a task does NOT imply permission to push. Commit freely after `npm run check` passes, then stop.

---

## Parallel Worktree Development

When working inside a git worktree (path contains a worktree suffix, or `git branch --show-current` is not `main`):

### 1. Identify your context first

```bash
git worktree list          # shows all worktrees and their branches
git branch --show-current  # confirms you are NOT on main
```

Never commit directly to `main` from a worktree.

### 2. Branch naming

`feat/<scope>-<slug>` — e.g., `feat/spotify-tag-ui`, `feat/blog-search-highlight`.

### 3. Scope declaration (required before writing any code)

Flag these **high-contention zones** immediately if they appear in scope:

| Zone | Risk |
|---|---|
| `package.json` / `package-lock.json` | Guaranteed merge conflict if two worktrees modify concurrently |
| `next.config.ts` | Global config; structural merges are fragile |
| `app/layout.tsx` | Root layout; any change affects every page |
| `lib/` shared files | Consumed across many modules and workers |
| `supabase/migrations/` | **Serialized — see rule 4** |
| `AGENT.md` / `CLAUDE.md` / sub-module `CLAUDE.md` | Convention changes belong in `main`, not feature branches |

If your task overlaps a contention zone another worktree is likely editing, **stop and tell the user**.

### 4. Supabase migrations are serialized

Only one worktree may author or apply a migration at a time. Migration filenames use timestamps as primary keys — two worktrees generating migrations simultaneously will collide and break `db push`. Declare schema changes upfront and wait for explicit coordination.

### 5. Never modify `package.json` without explicit permission

Lock-file conflicts from `npm install` in a worktree are painful to resolve.

### 6. Completion protocol

1. Run the appropriate check (see Multi-Step Tasks table).
2. Commit with a **self-contained message** — write as if the commit will be squash-merged.
3. **Stop.** Do not merge, rebase, or push. Wait for the user to review and integrate.

### 7. What a worktree agent must NOT do

- Run `git merge`, `git rebase`, or any operation that alters `main` or another worktree's branch.
- Edit `AGENT.md`, `CLAUDE.md`, or any sub-module `CLAUDE.md`.
- Push (same hard rule as `main`).

---

## Commands

```bash
npm run dev              # Start dev server with Turbopack
npm run build            # Production build (Turbopack)
npm run lint             # ESLint (Next.js app)
npm run lint:workers     # ESLint for all Cloudflare workers
npm run check            # Full type-check + lint (app + all workers)
npm run check:workers    # Type-check + lint workers only
ANALYZE=true npm run build  # Bundle analyzer

# Spotify data scripts (tsx)
npm run spotify:backfill-days   # Backfill recently-played history
npm run spotify:sync-tags       # Sync Last.fm tags (incremental)
npm run spotify:sync-tags:force # Sync Last.fm tags (force all)
```

---

## Supabase Migrations

CLI is installed as a local npm package — always use `npx supabase`, never assume a global binary.

Project linked to ref `ymdwknyxmbhckgftfena` (arthurs-blog, Mumbai).

```bash
npx supabase migration new <name>       # Creates supabase/migrations/<timestamp>_<name>.sql
npx supabase db push                    # Applies pending migrations to remote
npx supabase db query --linked "<sql>"  # Run ad-hoc SQL against remote
npx supabase db query --linked --file <path>  # Execute a SQL file against remote
npx supabase migration list             # Check local ↔ remote sync status
```

**Hard constraints:**
- Filename format: `<YYYYMMDDHHmmss>_<name>.sql` — CLI silently skips files that don't match.
- No duplicate version prefixes — always use `supabase migration new`, never hand-craft filenames.
- Baseline: as of 2026-05-14, all prior migrations consolidated into `20260514000000_baseline.sql`.

If remote history diverges: `npx supabase migration repair --status applied <version>` for each untracked remote entry, then re-run the original command.

---

## Deployment

Standalone Docker image, managed by `docker-compose.yml`. Watchtower auto-pulls new images from GHCR on push.

`env_file: .env.local` is only read at **container creation** time. After adding or changing an env var:

```bash
docker compose up -d   # run from /home/arthur/repositories/arthurs-blog
```

`docker restart` is not enough — it does not re-inject the env file.
