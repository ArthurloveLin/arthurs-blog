# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server with Turbopack
npm run build    # Production build (Turbopack)
npm run lint     # ESLint
```

No test suite is configured.

## Architecture

Personal blog + wardrobe management app. Next.js 15 App Router, React 20, TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + Auth), Cloudflare R2 for file storage.

### Data Layer

- **Blog posts**: Markdown files in R2 with YAML frontmatter (parsed by `gray-matter`), metadata indexed into Supabase via `/api/blog/reindex`. `lib/blog.ts` handles all queries with `unstable_cache` tag-based caching.
- **Wardrobe items**: Fully in Supabase. Images uploaded as WebP to R2 under `{sessionToken}/{itemId}.webp`.
- **Caching**: CDN headers in `next.config.ts` (blog posts 24h, homepage 1h). Server-side `unstable_cache` with tags (`posts`, `categories`, `tags`) for on-demand ISR.

### Auth & Roles

Three-tier: guest → user → admin. Guests use a token stored in localStorage (`lib/guest.ts`). Authenticated users go through Supabase Auth (SSR cookies via `lib/supabase-server.ts`). Admin role resolved from `user_roles` table in `lib/auth.ts`. Client-side uses anon key (`lib/supabase.ts`); service role key only used server-side.

### Wardrobe Sessions

Sessions have unique tokens (no login required). Items belong to sessions and have categories, ratings (appearance/practicality/value), notes, price. Drag-and-drop reordering via `@hello-pangea/dnd`. Admin-only image upload at `/api/admin/upload-image`.

### Key Patterns

- Server Components by default; `'use client'` only where needed for interactivity
- Root layout (`app/layout.tsx`) prefetches all sidebar data server-side and distributes via `SiteDataContext`
- Auth state distributed via `AuthProvider` (`useAuth` hook)
- Spotify now-playing via `SpotifyProvider`
- Middleware is minimal — auth token refresh is handled per-route in Server Actions/API routes due to Edge sandbox limitations

### Storage

- R2 blog bucket: markdown files + images
- R2 wardrobe bucket: session-namespaced images
- Public CDN domains: `images.arthurlovegrace.top`, `obsidian.arthurlovegrace.top`
