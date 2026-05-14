# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Module-level docs

- [`components/note-board/CLAUDE.md`](components/note-board/CLAUDE.md) — Note Board / Guestbook module: shell architecture, filter state flow, card component split, NoteActionButton convention, color theming.

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

### When to propose documentation

- **Mid-task** — when a non-obvious pattern surfaces or a new convention is established, capture it then, not at the end.
- **After exploring a module** — if no sub-module CLAUDE.md exists, ask whether one should be created.
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

Run `npm run check` after each significant step. No test suite exists, so type-check + lint is the only automated safety net.

### Shared Code

When modifying a shared component, call it out explicitly. Don't silently refactor adjacent code — if you notice unrelated issues, mention them instead of fixing them in the same change.

---

## Git Policy

> **HARD RULE — no exceptions:** Never run `git push` unless the user's message contains an explicit instruction to push (e.g., "推送", "push", "提交推送"). Finishing a task does NOT imply permission to push. Commit freely after `npm run check` passes, then stop — wait for the push command.

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

## Architecture

Personal blog + wardrobe management app. Next.js 15 (with `viewTransition` experimental enabled), React 19, TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + Auth), Cloudflare R2 for file storage. Deployed as a standalone Docker image.

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

- **Blog posts**: Markdown files in R2 with YAML frontmatter (parsed by `gray-matter`), metadata indexed into Supabase via `/api/blog/reindex`. `lib/blog.ts` handles all queries with `unstable_cache` tag-based caching (`posts`, `categories`, `tags`).
- **Wardrobe/Sessions**: Fully in Supabase. Items belong to sessions, have categories, multi-dimension ratings, notes, price. Supabase Realtime used for live updates (`RealtimeSync.tsx`). Images uploaded as WebP to R2 under `{sessionToken}/{itemId}.webp`. Session-level templates defined in `lib/templates.ts` (wardrobe, games, etc.).
- **Recipes**: Stored in Supabase with versioning/revision snapshots. `lib/recipes.ts` handles CRUD, revision history, and ingredient/step management.
- **Comments & Reactions**: Routed through the `engagement-worker` (Cloudflare Durable Objects). The Next.js app never writes comments directly to Supabase — it proxies via `lib/engagement-public-api.ts` → worker. Post reactions (upvote/downvote) and emoji reactions are batched and flushed by the worker. `lib/comments-server.ts` reads comment threads server-side.
- **Note Boards / Guestbook**: Notes stored in Supabase `comments` table with `target_type`/`target_id`. Board configs defined in `lib/note-board-config.ts`. Guestbook is a special note board.
- **Spotify**: Listening data stored as JSON shards in R2 (`spotify/` prefix). `lib/spotify.ts` reads these server-side. The `cloudflare-worker` handles Spotify OAuth token refresh and data sync. `lib/spotify-history-utils.ts` provides time-segment analysis helpers.
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
| `engagement-worker` | Comment queue (Durable Objects), rate limiting, post reactions, emoji reactions — all engagement writes go here |
| `cloudflare-worker` | Spotify data sync (OAuth, library/history snapshots to R2), now-playing proxy |
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
| Blog posts | 24h (set in blog API routes) |
| Homepage | 1h |
