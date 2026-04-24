/**
 * 本地全量 Last.fm 标签同步脚本
 *
 * 用法:
 *   npx tsx scripts/sync-lastfm-tags.ts [--force] [--dry-run]
 *
 *   --force    重新拉取已有标签的曲目（全量刷新）
 *   --dry-run  只显示待处理列表，不发请求不写 R2
 */
import dotenv from 'dotenv'
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local' })

// ─── 配置 ───────────────────────────────────────────────────────────────────

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!
const BUCKET = process.env.R2_SPOTIFY_BUCKET!
const LASTFM_API_KEY = process.env.LASTFM_API_KEY!

const TAGS_KEY = 'spotify/tags/track-tags.json'
const DASHBOARD_KEY = 'spotify/latest/dashboard.json'
const SAVED_TRACKS_KEY = 'spotify/collection/saved-tracks.json'
const RECENTLY_PLAYED_PREFIX = 'spotify/history/recently-played/'

const LASTFM_ENDPOINT = 'https://ws.audioscrobbler.com/2.0/'
const LASTFM_TIMEOUT_MS = 8000
const LASTFM_INTERVAL_MS = 300
const WRITE_BATCH_SIZE = 10

// ─── 类型 ───────────────────────────────────────────────────────────────────

interface TagValue { name: string; count: number }
interface TagEntry {
  trackId: string; artist: string; title: string
  fetchedAt: string; tagSource?: 'track' | 'artist'; tags: TagValue[]
}
interface TagStore { schemaVersion: 1; lastUpdatedAt: string; tracks: Record<string, TagEntry> }

interface Candidate { trackId: string; title: string; artist: string }
interface TrackSummary { id: string; title: string; artists: string[] }
interface SavedTrack { track: TrackSummary }
interface SavedTrackCollection { items: SavedTrack[] }
interface PlaylistItem { tracks: Array<{ track: TrackSummary }> }
interface PlaylistCollection { items: PlaylistItem[] }

// ─── S3 客户端 ──────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
})

async function r2ListKeys(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined

  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }))
    for (const obj of res.Contents ?? []) { if (obj.Key) keys.push(obj.Key) }
    token = res.NextContinuationToken
  } while (token)

  return keys
}

async function r2Get<T>(key: string): Promise<T | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const chunks: Buffer[] = []
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk))
    return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string }
    if (err?.name === 'NoSuchKey' || /NoSuchKey/i.test(err?.message ?? '')) return null
    throw e
  }
}

async function r2Put(key: string, payload: unknown) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
    Body: JSON.stringify(payload, null, 2),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-store',
  }))
}

// ─── 标签获取 ────────────────────────────────────────────────────────────────

async function lastfmFetch(params: Record<string, string>): Promise<TagValue[]> {
  const sp = new URLSearchParams({ ...params, api_key: LASTFM_API_KEY, format: 'json' })
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), LASTFM_TIMEOUT_MS)

  try {
    const res = await fetch(`${LASTFM_ENDPOINT}?${sp}`, { cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { error?: number; message?: string; toptags?: { tag?: unknown } }
    if (json.error) throw new Error(json.message ?? `error ${json.error}`)

    const raw = json.toptags?.tag
    const list = Array.isArray(raw) ? raw : raw ? [raw] : []
    return (list as Array<{ name?: string; count?: string | number }>)
      .map(t => ({ name: typeof t.name === 'string' ? t.name.trim() : '', count: Number(t.count) || 0 }))
      .filter(t => t.name.length > 0)
      .sort((a, b) => b.count - a.count)
  } finally {
    clearTimeout(tid)
  }
}

async function fetchTags(c: Candidate): Promise<{ tags: TagValue[]; source: 'track' | 'artist' }> {
  const trackTags = await lastfmFetch({ method: 'track.getTopTags', artist: c.artist, track: c.title, autocorrect: '1' })
  if (trackTags.length > 0) return { tags: trackTags, source: 'track' }

  await sleep(LASTFM_INTERVAL_MS)

  const artistTags = await lastfmFetch({ method: 'artist.getTopTags', artist: c.artist, autocorrect: '1' })
  return { tags: artistTags, source: 'artist' }
}

// ─── 候选曲目收集 ────────────────────────────────────────────────────────────

function collectCandidates(
  dashboard: Record<string, unknown>,
  savedTracks: SavedTrack[],
  recentlyPlayedHistory: TrackSummary[],
  playlists: PlaylistItem[],
): Candidate[] {
  const map = new Map<string, Candidate>()

  function add(id: string, title: string, artists: string[]) {
    if (!id || !title || !artists[0]) return
    if (!map.has(id)) map.set(id, { trackId: id, title: title.trim(), artist: artists[0].trim() })
  }

  const recentlyPlayed = (dashboard.recentlyPlayed as TrackSummary[]) ?? []
  for (const t of recentlyPlayed) add(t.id, t.title, t.artists)

  const topTracks = (dashboard.topTracks as Record<string, TrackSummary[]>) ?? {}
  for (const tracks of Object.values(topTracks)) for (const t of tracks) add(t.id, t.title, t.artists)

  for (const item of savedTracks) add(item.track.id, item.track.title, item.track.artists)

  for (const t of recentlyPlayedHistory) add(t.id, t.title, t.artists)

  for (const playlist of playlists) {
    const items = Array.isArray(playlist.tracks) ? playlist.tracks : Object.values(playlist.tracks as Record<string, { track: TrackSummary }>)
    for (const item of items) add(item.track.id, item.track.title, item.track.artists)
  }

  return Array.from(map.values())
}

// ─── 工具 ────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function progress(current: number, total: number, label: string) {
  const pct = Math.round((current / total) * 100)
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5))
  process.stdout.write(`\r[${bar}] ${String(current).padStart(String(total).length)}/${total} ${pct}% ${label.slice(0, 50).padEnd(50)}`)
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const dryRun = args.includes('--dry-run')

  for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_SPOTIFY_BUCKET', 'LASTFM_API_KEY']) {
    if (!process.env[key]) { console.error(`Missing env: ${key}`); process.exit(1) }
  }

  console.log('读取 R2 数据...')
  const [tagStore, dashboard, savedTracksFile, playlistsFile] = await Promise.all([
    r2Get<TagStore>(TAGS_KEY),
    r2Get<Record<string, unknown>>(DASHBOARD_KEY),
    r2Get<SavedTrackCollection>(SAVED_TRACKS_KEY),
    r2Get<PlaylistCollection>('spotify/collection/playlists.json'),
  ])

  if (!dashboard) { console.error('未找到 dashboard 快照，请先执行一次全量 Spotify 同步'); process.exit(1) }

  const tags: TagStore = tagStore ?? { schemaVersion: 1, lastUpdatedAt: new Date(0).toISOString(), tracks: {} }

  const savedTracks = savedTracksFile?.items ?? []
  console.log(`  saved-tracks: ${savedTracks.length} 条（全量）`)

  const playlists = playlistsFile?.items ?? []
  const playlistTrackTotal = playlists.reduce((n, p) => {
    const items = Array.isArray(p.tracks) ? p.tracks : Object.values(p.tracks as object)
    return n + items.length
  }, 0)
  console.log(`  playlists: ${playlists.length} 个，共 ${playlistTrackTotal} 条曲目`)

  const shardKeys = await r2ListKeys(RECENTLY_PLAYED_PREFIX)
  const dayShards = await Promise.all(shardKeys.map(k => r2Get<TrackSummary[]>(k)))
  const recentlyPlayedHistory = (dayShards.filter(Boolean) as TrackSummary[][]).flat()
  console.log(`  recently-played 分片: ${shardKeys.length} 天，共 ${recentlyPlayedHistory.length} 条播放记录`)

  const allCandidates = collectCandidates(dashboard, savedTracks, recentlyPlayedHistory, playlists)
  const pending = force
    ? allCandidates
    : allCandidates.filter(c => !tags.tracks[c.trackId])

  console.log(`曲目总计: ${allCandidates.length}  已有标签: ${allCandidates.length - pending.length}  待处理: ${pending.length}`)

  if (dryRun) {
    console.log('\n--dry-run 模式，待处理列表:')
    pending.forEach((c, i) => console.log(`  ${i + 1}. ${c.artist} - ${c.title}`))
    return
  }

  if (pending.length === 0) {
    console.log('所有曲目均已有标签，无需同步。如需强制刷新请加 --force')
    return
  }

  const syncedAt = new Date().toISOString()
  let ok = 0, failed = 0, artistFallback = 0
  const errors: string[] = []

  console.log('\n开始同步...\n')

  for (let i = 0; i < pending.length; i++) {
    const c = pending[i]
    progress(i, pending.length, `${c.artist} - ${c.title}`)

    try {
      const { tags: fetchedTags, source } = await fetchTags(c)

      tags.tracks[c.trackId] = {
        trackId: c.trackId, artist: c.artist, title: c.title,
        fetchedAt: new Date().toISOString(), tagSource: source, tags: fetchedTags,
      }

      ok++
      if (source === 'artist') artistFallback++

      if ((i + 1) % WRITE_BATCH_SIZE === 0 || i === pending.length - 1) {
        tags.lastUpdatedAt = syncedAt
        await r2Put(TAGS_KEY, tags)
        process.stdout.write(` ✓ [已写入]`)
      }
    } catch (e: unknown) {
      failed++
      const msg = `${c.artist} - ${c.title}: ${e instanceof Error ? e.message : String(e)}`
      errors.push(msg)
    }

    if (i < pending.length - 1) await sleep(LASTFM_INTERVAL_MS)
  }

  process.stdout.write('\n\n')
  console.log('='.repeat(60))
  console.log(`同步完成`)
  console.log(`  成功: ${ok}  失败: ${failed}  artist fallback: ${artistFallback}`)
  console.log(`  总曲目标签覆盖率: ${Object.keys(tags.tracks).length} / ${allCandidates.length}`)
  if (errors.length > 0) {
    console.log(`\n失败列表:`)
    errors.forEach(e => console.log(`  ✗ ${e}`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
