# GitHub Copilot Instructions

Personal blog + wardrobe management app. Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + Auth), Cloudflare R2. Deployed as a standalone Docker image.

Full project conventions are in `AGENT.md` at the repo root — load it for complete context.

---

## Architecture at a Glance

- **Server Components by default** — `'use client'` only where interaction or browser APIs are needed.
- **Auth**: three-tier — guest token (localStorage) → Supabase Auth (SSR cookies) → `user_roles` admin table.
- **Comments/reactions**: always proxied through `engagement-worker` via `lib/engagement-public-api.ts`. Never write directly to Supabase for comments.
- **CDN cache purge**: call `lib/cloudflare-cache.ts` after any mutation on a route that has `s-maxage` cache headers.
- **No test suite** — `tsc --noEmit && npm run lint` is the safety net after any logic change.

## High-Blast-Radius Zones

Call these out before touching them — don't refactor silently:

| Zone | Why |
|---|---|
| `engagement-worker` | Sole write path for all comments, reactions, emoji |
| `app/layout.tsx` + `SiteDataProvider` | Feeds every page's sidebar data |
| `lib/cloudflare-cache.ts` | Must be called after CDN-cached mutations |
| `MemoBoardShell` | Shared shell for `/memo` and `/guestbook` |

## Key Commands

```bash
npm run dev              # Dev server (Turbopack)
npm run check            # Full type-check + lint — run after any logic change
npm run check:workers    # Workers only
npx supabase db push     # Apply pending migrations to remote
```

## Git Policy

**Never `git push`** unless the user explicitly says to push. Commit freely once check passes, then stop.

## Worktree / Parallel Dev

**Do not create a worktree by default** — work in the current checkout. Only create one when the user explicitly asks. When asked, place it in the sibling `arthurs-blog.worktrees/` dir: `git worktree add ../arthurs-blog.worktrees/<slug> -b feat/<scope>-<slug>`.

When on a feature branch (not `main`):
- Branch naming: `feat/<scope>-<slug>`
- Declare scope upfront; flag if touching `package.json`, `supabase/migrations/`, or `app/layout.tsx`
- Only one branch may touch migrations at a time
- Completion: check passes → commit → stop (no merge, no push)
