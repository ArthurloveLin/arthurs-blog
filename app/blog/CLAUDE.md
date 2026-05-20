# Blog Module

Static-content blog: Markdown posts stored in R2, metadata indexed in Supabase, served via Next.js `unstable_cache`.

## File Map

```
lib/blog.ts                    — all queries, cache definitions, Post type, upsertPost/deletePost
app/blog/[slug]/page.tsx       — individual post page
app/api/blog/reindex/route.ts  — reindex trigger (R2 → Supabase + cache invalidation)
app/api/posts/[id]/            — post engagement API (comment counts, reactions)
app/search/, app/archive/, app/category/, app/tag/ — reading list views
lib/blog-search.ts             — client-side full-text search (tokenized matching)
```

## Cache Architecture

All queries use `unstable_cache` from `next/cache`. TTL values are load-bearing — see constraint below.

| Data | TTL | Cache tags |
|---|---|---|
| Post content & metadata | 86400s | `post-meta:{slug}`, `post-content:{slug}`, `post-raw:{r2_key}` |
| Category / tag / year aggregates | 3600s | `categories`, `allTags`, `year-archive:{year}`, etc. |
| Sidebar: recent posts, counts | 1800s | `recent-posts`, `posts-count` |
| Site config | `revalidate: false` | `site-config` |

### TTL constraint — do not use `revalidate: false` for post data

`revalidateTag()` clears the in-memory stale-tag set, but the actual cache data lives in `.next/cache/fetch-cache/` on disk. After a Docker redeploy or `next dev` restart, in-memory markers are gone — on-disk stale data is served as fresh indefinitely unless a TTL expires it. **Every post/aggregate cache must carry a numeric TTL** so Docker restarts self-heal within the TTL window.

`getSiteConfig` intentionally uses `revalidate: false` — config entries change only via admin action that explicitly calls `revalidateTag('site-config')`, and config staleness has no user-visible impact.

## Reindex (`/api/blog/reindex`)

Triggers on demand (e.g., admin button or CI deploy hook). Workflow:
1. List all `.md` objects in R2 blog bucket
2. **Delta detection**: compare `R2 lastModified > DB updated_at`. Only changed files are re-processed. Use `?force=1` to skip delta and reindex all.
3. Parse frontmatter, call `upsertPost()` (sets `updated_at = new Date().toISOString()` — Node.js clock)
4. Delete DB records for keys no longer in R2
5. `revalidateTag(...)` for all affected cache tags
6. `purgeCloudflareZone()` or `purgeCloudflareFiles()` — CF CDN purge. Response includes a `cloudflare` field; check it to confirm purge succeeded.

### Delta detection caveat
`upsertPost()` sets `updated_at` from Node.js clock. If R2 `lastModified` is ahead of DB `updated_at` by a tiny margin due to clock skew, the post will always look "changed." Use `?force=1` if delta is suspected wrong.

## Hard Constraints

- Never use `cache()` from React for long-lived data — it only deduplicates within a single render pass, not across requests. Use `unstable_cache`.
- Do not add a new `unstable_cache` entry with `revalidate: false` for any post or aggregate data.
- After any mutation that changes post data, call both `revalidateTag()` and `purgeCloudflareFiles()` — one covers Next.js ISR, the other covers CF CDN.
