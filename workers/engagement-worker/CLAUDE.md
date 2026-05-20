# engagement-worker

Sole write path for all blog comments. The Next.js app **never writes comments directly to Supabase** — it always goes through this worker via `lib/engagement-public-api.ts` → `NEXT_PUBLIC_ENGAGEMENT_WORKER_URL`.

## File Map

```
src/index.ts   — entire worker: routes, DurableObject, all helpers (single-file)
wrangler.jsonc — bindings, env vars, DO migration history
```

## Routes

| Method | Path | Handler |
|---|---|---|
| GET | `/api/comments` | `handleCommentThreadGet` — fetch thread, CF-cached |
| POST | `/api/comments` | `handleCommentCreate` — rate-limit → validate → insert |
| PATCH | `/api/comments/:id` | `handleCommentMutation` — identity/admin auth → update |
| DELETE | `/api/comments/:id` | `handleCommentMutation` — identity/admin auth → delete |
| GET | `/health` | health check |

## Architecture Decisions

### Thread cache (CF Cache API)
`caches.default` with `Cache-Control: public, s-maxage=60`. Cache key is a normalized URL containing only `target_type` + `target_id` (and optionally `archived`). Two variants are stored: **default** (no `archived` filter) and **active** (`archived=false`).

When a non-default query arrives (search, tag, pagination), the worker loads the cached array into memory and filters it rather than calling Supabase again — so pagination/search doesn't bypass the cache. After any write (create/update/delete), both variants are invalidated via `ctx.waitUntil(caches.default.delete(...))`.

### CommentRateLimiterDurableObject
Per-IP rate limiting. The DO is named by client IP (`cf-connecting-ip` header). It stores `{ count, resetAt }` in DO storage and schedules an alarm at `resetAt` to delete the counter. Default: 5 requests / 60s window.

The DO class uses SQLite-mode (`new_sqlite_classes`). The counter is persisted synchronously; alarm fires even if the worker instance dies.

### Direct Supabase insert (no queue)
Comments are inserted directly to Supabase using the service-role key. There is no Durable Object queue anymore — this was removed in a past refactor (see migration tags `v1-comment-queue` and `v5-delete-comment-queue` in `wrangler.jsonc`).

### Admin auth
Admin actions (e.g., delete any comment) require a Supabase JWT in the `Authorization: Bearer <token>` header. The worker validates it against `/auth/v1/user`, then checks `user_roles` table for `role = 'admin'`. Guest identity uses the `identity` / `identities` field in the request body — matched against `comment.author`.

### ntfy notification
New comments trigger `sendNtfyWorker` (fire-and-forget via `ctx.waitUntil`). Config: `NTFY_EXTERNAL_URL` (required) + optional `NTFY_TOKEN` (Bearer auth). Topic hardcoded as `blog-comments`.

## Hard Constraints

- **Do not add emoji reaction write routes here.** Emoji reactions are read-only from this worker (aggregated from `comment_emoji_reactions` via Supabase at thread-read time). There is no route to add/remove them via the worker.
- **Dead code warning**: Post-reaction functions (`callSupabasePostReactionRpc`, `applyPostReactionTransition`, `fetchOriginPostEngagementSummary`) and their types exist in `index.ts` but have **no HTTP routes** — they are leftover from a previous iteration (`v3-post-reactions` / `v4-delete-post-reactions` migration). Do not uncomment or wire them up without a new migration plan.
- **proxyRequest is also dead code** — defined but unused.
- Cache invalidation always fires both the default and active variants. If you add a new archived variant, add its key to `getCommentThreadCacheKeys`.

## Migration History (wrangler.jsonc)

| Tag | Action |
|---|---|
| v1-comment-queue | CommentQueueDO (deleted in v5) |
| v2-comment-rate-limit | CommentRateLimiterDO (active) |
| v3-post-reactions | PostReactionDO (deleted in v4) |
| v4-delete-post-reactions | deleted PostReactionDO |
| v5-delete-comment-queue | deleted CommentQueueDO |

Never re-create a deleted class name — CF DO migrations are append-only.

## Env Vars (wrangler.jsonc `vars`)

| Var | Purpose |
|---|---|
| `ORIGIN_BASE_URL` | Next.js origin for any upstream proxying |
| `SUPABASE_URL` | Supabase REST base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret — set via wrangler secret |
| `COMMENT_MAX_LENGTH` | Default 500 |
| `COMMENT_URL_LIMIT` | Default 2 URLs per comment |
| `COMMENT_BLOCKED_TERMS` | Comma-separated spam terms |
| `COMMENT_RATE_LIMIT_MAX_REQUESTS` | Default 5 |
| `COMMENT_RATE_LIMIT_WINDOW_SECONDS` | Default 60 |
| `NTFY_EXTERNAL_URL` | ntfy push endpoint |
| `NTFY_TOKEN` | Optional ntfy Bearer token |
