# cloudflare-worker (spotify-sync-worker)

Spotify data sync engine + public data API. Reads/writes R2, exposes read endpoints consumed by the Next.js `components/spotify/` module. Also serves `/api/now-playing` (proxied by `spotify-now-playing-worker` for lighter caching).

## File Map

```
src/index.ts          — main fetch + scheduled handlers, public route definitions
src/spotify.ts        — R2 read/write: library, history shards, stream data, music report
src/spotify-tags.ts   — Last.fm tag sync (reads from archive, writes tag store to R2)
src/spotify-types.ts  — shared TypeScript types for Spotify data shapes
src/now-playing-cache.ts — Cache-Control header logic for now-playing responses
src/r2.ts             — R2 helper (get/put/list JSON shards)
src/env.ts            — Cloudflare.Env extension type
wrangler.toml         — R2 binding, cron triggers, env vars
```

## Public Routes (GET, no auth, all edge-cached)

All public routes use `respondFromEdgeCache` — the response is stored in `caches.default` keyed on the full request URL. Cache is populated on miss; a hit is returned directly without touching R2.

| Path | Cache-Control | Notes |
|---|---|---|
| `/api/now-playing` | dynamic (from `now-playing-cache.ts`) | playing → short TTL; idle → longer |
| `/api/spotify/history/days` | `max-age=300, swr=600` | list of available day shard keys |
| `/api/spotify/history?date=YYYY-MM-DD` | today: `max-age=60`; past: `max-age=3600` | single day shard from R2 |
| `/api/spotify/history/stream` | `max-age=300, swr=3600` | pre-aggregated stream JSON |
| `/api/spotify/library/tracks` | `max-age=3600, swr=86400` | paginated saved tracks (`offset`, `limit`) |
| `/api/spotify/playlists/:id` | `max-age=3600, swr=86400` | single playlist shard |
| `/api/spotify/tags?ids=` | `max-age=3600, swr=86400` | Last.fm tag data for given track IDs |
| `/api/spotify/report` | `max-age=300, swr=600` | music report JSON |

## Sync Trigger (POST or GET to `/` or `/sync`)

Auth: header `x-spotify-sync-secret` or `?secret=` query param, timing-safe compared against `SPOTIFY_SYNC_SECRET`. Mode: `?mode=full` for full sync, default is `quick`.

Sync workflow (`runSyncWorkflow`):
1. `syncSpotifyDashboardToArchive(env, { mode })` — fetch from Spotify API → write R2 shards
2. If `mode === 'full'`: `readSpotifyTagCandidatesFromArchive` + `syncSpotifyTrackTags` (Last.fm, max 35 tracks per run)
3. `generateAndSaveStreamData(env)` — rebuild stream JSON from shards
4. `generateAndSaveMusicReport(env)` — rebuild report JSON from shards
5. Revalidate Next.js: `GET {NEXTJS_SITE_URL}/api/revalidate?secret={SPOTIFY_SYNC_SECRET}`

## Cron Schedules

| Cron | UTC time | Mode |
|---|---|---|
| `5 16 * * *` | 16:05 UTC (00:05 BJT) | full (includes Last.fm tag sync) |
| `*/10 * * * *` | every 10 min | quick (skips tag sync) |

## Hard Constraints

- **Edge cache is URL-keyed.** If you add a new query param to an existing route, the old cached response will still be served for requests without that param. Bust the cache by purging in CF Dashboard or waiting for natural expiry.
- **`LASTFM_API_KEY` is optional but required for tag sync.** If absent, tag sync silently skips (`syncSpotifyTrackTags` checks `candidates.length > 0` but the key missing causes Last.fm fetch to fail). The full-sync cron will still run the rest of the workflow.
- **R2 bucket binding name is `SPOTIFY_BUCKET`.** All R2 access goes through `src/r2.ts`. Data public domain is `music.arthurlovegrace.top` (configured in `wrangler.toml`).
- **Revalidation is fire-and-forget** (`ctx.waitUntil`) in manual sync, awaited in scheduled sync. Failure to revalidate does not fail the sync.

## Env Vars

| Var | Secret? | Purpose |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | yes | Spotify OAuth |
| `SPOTIFY_CLIENT_SECRET` | yes | Spotify OAuth |
| `SPOTIFY_REFRESH_TOKEN` | yes | Spotify OAuth token refresh |
| `LASTFM_API_KEY` | yes | Last.fm tag lookup (optional) |
| `SPOTIFY_SYNC_SECRET` | yes | auth for manual sync trigger + Next.js revalidation |
| `NEXTJS_SITE_URL` | var | Next.js origin for revalidation calls |
| `R2_SPOTIFY_PUBLIC_DOMAIN` | var | public CDN domain for R2 data |
