# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Module-level docs

- [`components/note-board/CLAUDE.md`](components/note-board/CLAUDE.md) — Note Board / Guestbook module: shell architecture, filter state flow, card component split, NoteActionButton convention, color theming.
- [`app/blog/CLAUDE.md`](app/blog/CLAUDE.md) — Blog module: `unstable_cache` TTL constraints, reindex delta detection, CF cache purge.
- [`components/recipe/CLAUDE.md`](components/recipe/CLAUDE.md) — Recipe module: book-shell theme switching, right-panel overlay context, revision system, skill graph.
- [`workers/engagement-worker/CLAUDE.md`](workers/engagement-worker/CLAUDE.md) — engagement-worker: routes, CommentRateLimiterDO, thread cache, dead code warnings.
- [`workers/cloudflare-worker/CLAUDE.md`](workers/cloudflare-worker/CLAUDE.md) — cloudflare-worker (spotify-sync-worker): public API routes, sync workflow, cron schedule.
- [`components/spotify/CLAUDE.md`](components/spotify/CLAUDE.md) — Spotify dashboard: server-vs-client data layers, pagination hook, poster system, tag component imports.
- [`workers/genius-worker/CLAUDE.md`](workers/genius-worker/CLAUDE.md) — genius-worker: 执行流程、Genius 非标 JSON 解析、歌词多步清理顺序、KV 缓存策略。
- [`workers/spotify-now-playing-worker/CLAUDE.md`](workers/spotify-now-playing-worker/CLAUDE.md) — now-playing worker: 内存 token 缓存、播放状态感知 Cache-Control、强制刷新绕过。
- [`app/session/CLAUDE.md`](app/session/CLAUDE.md) — Session 模块: 模板系统、custom 模板维度约束（3–6 个）、template_config 仅在 custom 时传入。
- [`components/life-gallery/CLAUDE.md`](components/life-gallery/CLAUDE.md) — Life Gallery: 5 层叠卡时序常量耦合、canvas 取色竞态保护、mod 环形导航。
- [`components/now-watching/CLAUDE.md`](components/now-watching/CLAUDE.md) — Now Watching: prefetchedRef 预加载策略、GSAP 视差列选择、IntersectionObserver 触底。
- [`app/memo/CLAUDE.md`](app/memo/CLAUDE.md) — Memo 页面: 流式 Suspense 分层、force-dynamic 原因、三源配置融合优先级。

## Living Documentation

This project uses a three-layer system. Claude is expected to actively maintain all three.

| Layer | Location | Purpose |
|---|---|---|
| Memory | `~/.claude/projects/.../memory/` | User preferences, session feedback, cross-session project state |
| Root CLAUDE.md | This file | Project-wide conventions, architectural facts, high-blast-radius zones |
| Sub-module CLAUDE.md | `<module>/CLAUDE.md` | Module-specific non-obvious patterns |

### What is worth documenting

Write when you discover or establish:
- A pattern that cannot be derived by reading the code
- A convention decided in this session (naming, structure, visual rules)
- A hard constraint or banned alternative that would trip up a future Claude
- A stale entry — update or remove it immediately, never leave contradictory entries side by side

Do not document: things derivable from code reading, git history, ephemeral task state, or anything already captured elsewhere.

### Documentation decision gate (required before creating any CLAUDE.md)

Before writing a new sub-module CLAUDE.md — or adding a section to an existing one — **say out loud**:

> "If a Claude read only the source files, would it make a wrong decision here?"

- **Yes** → write it. State specifically what wrong decision would be made.
- **No / Unsure** → don't write it. Check if a code comment in the source file is the better home.

Complexity alone is not sufficient justification. A 700-line file with clear variable names and existing comments does not need a CLAUDE.md. A 100-line file with a hidden timing invariant or a deleted-class landmine does.

Two common failure modes to avoid:
1. **Re-explaining code** — documenting what `if (length >= 6) return` already enforces. The code is the doc.
2. **Documenting comments** — if the source file already has comments explaining the design decision, a CLAUDE.md that paraphrases them adds maintenance cost with no benefit.

### When to propose documentation

- **Mid-task** — when a non-obvious pattern surfaces or a new convention is established, capture it then, not at the end.
- **After exploring a module** — if no sub-module CLAUDE.md exists, *apply the decision gate first* before asking whether one should be created.
- **After completing a significant task** — close with: "Should I document any findings from this session?"

### Sub-module CLAUDE.md checklist

A good sub-module CLAUDE.md answers four questions:
1. What does each file own? (brief file map)
2. What are the non-obvious architectural decisions?
3. What are the hard constraints? (must-use patterns, banned alternatives)
4. What would a future Claude naturally get wrong here?

---

## Coding Conventions

### Think Before Coding

Before implementing, **state your interpretation** if a request could be read multiple ways. Don't pick silently — present the options and confirm.

Name any shared infrastructure your change will touch. This codebase has several high-blast-radius pieces:
- `engagement-worker` — sole write path for all comments, reactions, emoji
- `MemoBoardShell` — shared shell for both `/memo` and `/guestbook`
- `SiteDataProvider` / root layout — feeds every page's sidebar data
- `lib/cloudflare-cache.ts` — must be called after mutations that have CDN cache headers

When scope is ambiguous (especially for data-layer or worker changes), ask rather than assume.

### Multi-Step Tasks

For non-trivial tasks, state a brief plan before starting:

```
1. [step] → verify: [check]
2. [step] → verify: [check]
```

No test suite exists, so type-check + lint is the only automated safety net. After each significant step, run the check that matches the change scope:

| Level | When | Command |
|---|---|---|
| **File** | Pure markup / style / comment change; no type-surface touched | `npx eslint <file>` |
| **App** | Logic or type changes confined to `app/`, `components/`, `lib/` | `tsc --noEmit && npm run lint` |
| **Workers** | Changes only inside `workers/` | `npm run check:workers` |
| **Full** | Cross-cutting: shared types, `lib/` consumed by workers, config, or any multi-zone change | `npm run check` |

When in doubt, go one level up. If a "File" change touches an exported type, treat it as **App**.

### Shared Code

When modifying a shared component, call it out explicitly. Don't silently refactor adjacent code — if you notice unrelated issues, mention them instead of fixing them in the same change.

---

## Git Policy

> **HARD RULE — no exceptions:** Never run `git push` unless the user's message contains an explicit instruction to push (e.g., "推送", "push", "提交推送"). Finishing a task does NOT imply permission to push. Commit freely after `npm run check` passes, then stop — wait for the push command.

## Supabase Migrations

CLI is installed as a local npm package — always use `npx supabase`, never assume a global binary.

Project is linked to ref `ymdwknyxmbhckgftfena` (arthurs-blog, Mumbai). Link is stored in `supabase/.temp/` and persists across sessions as long as that directory is not deleted; re-run `npx supabase link --project-ref ymdwknyxmbhckgftfena` if it goes missing.

### Migration workflow

```bash
npx supabase migration new <name>       # Creates supabase/migrations/<timestamp>_<name>.sql
# Edit the file, then:
npx supabase db push                    # Applies pending migrations to remote
npx supabase db query --linked "<sql>"  # Run ad-hoc SQL against remote (no migration file)
npx supabase db query --linked --file <path>  # Execute a SQL file against remote
npx supabase migration list             # Check local ↔ remote sync status
```

### Hard constraints

- **Filename format**: migrations must be `<YYYYMMDDHHmmss>_<name>.sql`. The CLI silently skips files that don't match (e.g. bare `019.sql`).
- **No duplicate version prefixes**: two files sharing the same timestamp prefix break `db pull` and leave one permanently untracked. Always use `supabase migration new` — never hand-craft filenames.
- **Baseline**: as of 2026-05-14, all prior migrations (002–034) were consolidated into `supabase/migrations/20260514000000_baseline.sql`. This is the only migration file; do not re-create the old files.

### If remote history diverges from local

`db push` / `db pull` will refuse with a "migration history does not match" error. Fix order:
1. `npx supabase migration repair --status applied <version>` for each untracked remote entry
2. Then re-run the original command

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

No test suite is configured.

## Deployment

Standalone Docker image, managed by `docker-compose.yml` in the repo root. Watchtower auto-pulls new images from GHCR on push.

### Env var changes require `docker compose up -d`

`env_file: .env.local` is only read at **container creation** time. Watchtower updates the image but reconstructs the container from the original creation parameters — it does **not** re-read `.env.local`. After adding or changing an env var, run:

```bash
docker compose up -d   # run from /home/arthur/repositories/arthurs-blog
```

`docker restart` is not enough — it restarts the process but does not re-inject the env file.

### Docker image tags

Each push to `main` automatically produces these tags in GHCR:

| Tag | Example | Meaning |
|---|---|---|
| `latest` | `latest` | Always the current `main` tip; Watchtower tracks this |
| `sha-<short>` | `sha-32285dc` | Immutable snapshot of a specific commit |
| `main` | `main` | Same as `latest` for branch-based reference |
| `v<date>-<time>` | `v2025.05.20-1523` | Auto-generated release snapshot (UTC); **no rebuild** — re-tags the sha image |

The `release` CI job runs in parallel with `deploy` after `docker` completes. It uses `docker buildx imagetools create` to copy the digest (no rebuild), then calls the GitHub API to create a matching git tag. No manual tagging required.

### Rollback SOP

1. **Find the target version** — either a named tag or the sha of a good commit:

   ```bash
   git log --oneline -10                          # find the commit sha
   # or: check GHCR package page for available tags
   ```

2. **Pull the target image on the server:**

   ```bash
   docker pull ghcr.io/arthurlovelin/arthurs-blog:v2025.05.18
   # or by sha:
   docker pull ghcr.io/arthurlovelin/arthurs-blog:sha-9fec17d
   ```

3. **Edit `docker-compose.yml`** — change `image:` to the target tag:

   ```yaml
   image: ghcr.io/arthurlovelin/arthurs-blog:v2025.05.18
   ```

4. **Recreate the container:**

   ```bash
   docker compose up -d   # run from /home/arthur/repositories/arthurs-blog
   ```

5. **Restore normal tracking** — after the issue is fixed, revert `docker-compose.yml` back to `:latest` and `docker compose up -d` again.

---

## Architecture

Personal blog + wardrobe management app. Next.js 16 (with `viewTransition` experimental enabled), React 19, TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + Auth), Cloudflare R2 for file storage. Deployed as a standalone Docker image.

### Application Routes

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

### Data Layer

- **Blog posts**: Markdown files in R2, metadata indexed in Supabase via `/api/blog/reindex`. `lib/blog.ts` handles all queries with `unstable_cache` tag-based caching. See [`app/blog/CLAUDE.md`](app/blog/CLAUDE.md) for cache TTL constraints, reindex delta detection, and CF purge details.
- **Wardrobe/Sessions**: Fully in Supabase. Items belong to sessions, have categories, multi-dimension ratings, notes, price. Supabase Realtime used for live updates (`RealtimeSync.tsx`). Images uploaded as WebP to R2 under `{sessionToken}/{itemId}.webp`. Session-level templates defined in `lib/templates.ts` (wardrobe, games, etc.).
- **Recipes**: Stored in Supabase with versioning/revision snapshots. `lib/recipes.ts` handles CRUD, revision history, and ingredient/step management. See [`components/recipe/CLAUDE.md`](components/recipe/CLAUDE.md) for book-shell architecture and revision system.
- **Comments & Reactions**: Routed through the `engagement-worker`. The Next.js app never writes comments directly to Supabase — it proxies via `lib/engagement-public-api.ts` → worker. `lib/comments-server.ts` reads comment threads server-side. See [`workers/engagement-worker/CLAUDE.md`](workers/engagement-worker/CLAUDE.md) for routes, DO architecture, and hard constraints.
- **Note Boards / Guestbook**: Notes stored in Supabase `comments` table with `target_type`/`target_id`. Board configs defined in `lib/note-board-config.ts`. Guestbook is a special note board.
- **Spotify**: Listening data stored as JSON shards in R2 (`spotify/` prefix). `lib/spotify.ts` reads these server-side. The `cloudflare-worker` handles Spotify OAuth token refresh and data sync. See [`workers/cloudflare-worker/CLAUDE.md`](workers/cloudflare-worker/CLAUDE.md) for sync workflow and cron schedule.
- **Trend Radar**: Aggregated trending data stored as JSON in R2 (`trend-radar/` prefix), read by `lib/trend-radar.ts`.
- **Now Watching**: Poster images and metadata JSON stored in R2 (`now-watching/` prefix), read by `lib/now-watching.ts`.
- **Life Gallery**: Images in R2 under `Gallery/` prefix, organized by theme folders. Read by `lib/life-gallery.ts`.
- **Analytics**: Self-hosted Umami at `analytics.arthurlovegrace.top`. Server-side queries via `lib/umami.ts`.

### Auth & Roles

Three-tier: guest → user → admin. Guests use a token stored in localStorage (`lib/guest.ts`). Authenticated users go through Supabase Auth (SSR cookies via `lib/supabase-server.ts`). Admin role resolved from `user_roles` table in `lib/auth.ts`. Client-side uses anon key (`lib/supabase-client.ts`); service role key only used server-side (`lib/supabase-admin.ts`).

### Cloudflare Workers

Six workers in the `workers/` directory, each independently deployable:

| Worker | Purpose |
|---|---|
| `engagement-worker` | All comment writes (rate limiting via DO, direct Supabase insert), comment thread cache, ntfy notifications — see sub-module CLAUDE.md |
| `cloudflare-worker` | Spotify data sync (OAuth, library/history snapshots to R2), public Spotify data API — see sub-module CLAUDE.md |
| `spotify-now-playing-worker` | Lightweight now-playing endpoint (cached) |
| `genius-worker` | Genius API proxy for lyrics/song metadata |
| `spotify-image-proxy` | Spotify artwork proxy (CORS + caching) |
| `wardrobe-supabase-worker` | Wardrobe data proxy to Supabase |

The Next.js app communicates with `engagement-worker` via `NEXT_PUBLIC_ENGAGEMENT_WORKER_URL`. Comment reads can bypass the worker (direct Supabase admin query in `comments-server.ts`); writes always go through the worker.

### Key Patterns

- Server Components by default; `'use client'` only where needed.
- Root layout (`app/layout.tsx`) fetches blog sidebar data server-side (config, counts, categories, tags, year archive, recent posts) and distributes via `SiteDataProvider` / `useSiteData` hook.
- Auth state distributed via `AuthProvider` (`useAuth` hook).
- Spotify now-playing via `SpotifyProvider`.
- Cloudflare cache purging after mutations: `lib/cloudflare-cache.ts` calls the CF Zones API to purge by URL.
- `viewTransition: true` in `next.config.ts` enables the React View Transitions API; `DirectionalTransition.tsx` wraps navigation for slide animations.
- Anti-bot protection on comment/note submission via Cloudflare Turnstile (`lib/turnstile.ts`, `components/Turnstile.tsx`).
- OCR for wardrobe item import via Baidu OCR API (`lib/item-ocr.ts`) — extracts product name, price, and category from screenshots.
- Blog full-text search is client-side via `lib/blog-search.ts` with tokenized matching and highlight splitting.

### Storage

- R2 blog bucket: markdown posts, blog images, Spotify data shards, trend radar data, now-watching posters, life gallery images
- R2 wardrobe bucket: session-namespaced item images
- Public CDN domains: `images.arthurlovegrace.top` (wardrobe bucket), `obsidian.arthurlovegrace.top` (blog bucket)

### CDN Cache Headers (next.config.ts)

| Path | Cache |
|---|---|
| `/memo`, `/guestbook` | `s-maxage=120, stale-while-revalidate=3600` |
| `/wardrobe` | `no-store` |
| `/recipe/*` | `s-maxage=3600, stale-while-revalidate=86400` |
| `/blog/:path*` | no explicit header — Next.js ISR default (`s-maxage=31536000`) |
| Homepage | 1h |
