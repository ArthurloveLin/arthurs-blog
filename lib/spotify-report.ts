import 'server-only'

import { aggregateTags } from './spotify-tag-analysis'
import { getStoredSpotifyDashboardData, listRecentlyPlayedDays, readRecentlyPlayedDayShard } from './spotify'
import { readSpotifyTrackTagStore } from './spotify-tags'
import { buildWeekDayKeys } from './spotify-history-utils'
import type { SpotifyRecentlyPlayedTrack, SpotifyTrackTagStore } from './spotify-types'

export interface MusicReportTopTrack {
  title: string
  artist: string
  albumImageUrl: string | null
  playCount: number
  durationMs: number
  tags: string[]
  peakHour: number | null
}

export interface MusicReportTopArtist {
  name: string
  playCount: number
  totalMinutes: number
  imageUrl: string | null
  tags: string[]
  peakHour: number | null
}

export interface MusicReportTopContext {
  label: string
  type: string
  playCount: number
  imageUrl: string | null
}

export interface MusicReportStats {
  period: 'day' | 'week' | 'month'
  periodLabel: string
  dateRange: string
  topTrack: MusicReportTopTrack | null
  topArtist: MusicReportTopArtist | null
  top5Tracks: MusicReportTopTrack[]
  top5Artists: MusicReportTopArtist[]
  topContext: MusicReportTopContext | null
  top2Contexts: MusicReportTopContext[]
  topTag: string | null
  totalPlays: number
  totalMinutes: number
  peakHour: number | null
}

export interface MusicReport {
  day: MusicReportStats
  week: MusicReportStats
  month: MusicReportStats
  generatedAt: string
}

function toYMD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toYM(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthDay(dateKey: string) {
  const [, month = '01', day = '01'] = dateKey.split('-')
  return `${month}/${day}`
}

function computeStats(
  tracks: SpotifyRecentlyPlayedTrack[],
  tagStore: SpotifyTrackTagStore | null,
  artistImageMap: Map<string, string>,
  contextImageMap: Map<string, string>,
  period: 'day' | 'week' | 'month',
  periodLabel: string,
  dateRange: string
): MusicReportStats {
  if (tracks.length === 0) {
    return { period, periodLabel, dateRange, topTrack: null, topArtist: null, top5Tracks: [], top5Artists: [], topContext: null, top2Contexts: [], topTag: null, totalPlays: 0, totalMinutes: 0, peakHour: null }
  }

  // Top tracks (by play count)
  const trackMap = new Map<string, { track: SpotifyRecentlyPlayedTrack; count: number }>()
  for (const t of tracks) {
    const e = trackMap.get(t.id)
    if (e) { e.count++ } else { trackMap.set(t.id, { track: t, count: 1 }) }
  }
  const sortedTracks = [...trackMap.values()].sort((a, b) => b.count - a.count)
  const top5Tracks: MusicReportTopTrack[] = sortedTracks.slice(0, 5).map(e => ({
    title: e.track.title,
    artist: e.track.artists[0] ?? '',
    albumImageUrl: e.track.albumImageUrl,
    playCount: e.count,
    durationMs: e.track.durationMs,
    tags: tagStore?.tracks[e.track.id]?.tags.map(t => t.name) ?? [],
    peakHour: (function() {
      const hMap = new Map<number, number>()
      for (const t of tracks.filter(x => x.id === e.track.id)) {
        const h = new Date(t.playedAt).getUTCHours()
        hMap.set(h, (hMap.get(h) ?? 0) + 1)
      }
      const topH = [...hMap.entries()].sort((a, b) => b[1] - a[1])[0]
      return topH ? (topH[0] + 8) % 24 : null
    })(),
  }))
  const topTrack: MusicReportTopTrack | null = top5Tracks[0] ?? null

  // Top artists (with image lookup from dashboard)
  const artistMap = new Map<string, number>()
  for (const t of tracks) {
    for (const a of t.artists) {
      artistMap.set(a, (artistMap.get(a) ?? 0) + 1)
    }
  }
  const sortedArtists = [...artistMap.entries()].sort((a, b) => b[1] - a[1])
  const top5Artists: MusicReportTopArtist[] = sortedArtists.slice(0, 5).map(([name, playCount]) => ({
    name,
    playCount,
    totalMinutes: Math.round(tracks.filter(t => t.artists.includes(name)).reduce((sum, t) => sum + t.durationMs, 0) / 60000),
    imageUrl: artistImageMap.get(name) ?? null,
    tags: tagStore ? aggregateTags(tracks.filter(t => t.artists.includes(name)).map(t => t.id), tagStore).slice(0, 5).map(t => t.name) : [],
    peakHour: (function() {
      const hMap = new Map<number, number>()
      for (const t of tracks.filter(x => x.artists.includes(name))) {
        const h = new Date(t.playedAt).getUTCHours()
        hMap.set(h, (hMap.get(h) ?? 0) + 1)
      }
      const topH = [...hMap.entries()].sort((a, b) => b[1] - a[1])[0]
      return topH ? (topH[0] + 8) % 24 : null
    })(),
  }))
  const topArtist: MusicReportTopArtist | null = top5Artists[0] ?? null

  // Top context (loyalty)
  const ctxMap = new Map<string, { label: string; type: string; count: number }>()
  for (const t of tracks) {
    if (!t.context) continue
    const key = `${t.context.type}:${t.context.label}`
    const e = ctxMap.get(key)
    if (e) { e.count++ } else { ctxMap.set(key, { label: t.context.label, type: t.context.type, count: 1 }) }
  }
  const sortedContexts = [...ctxMap.values()].sort((a, b) => b.count - a.count)
  // For artist-type contexts, fall back to artistImageMap
  const top2Contexts: MusicReportTopContext[] = sortedContexts.slice(0, 4).map(e => ({
    label: e.label,
    type: e.type,
    playCount: e.count,
    imageUrl: contextImageMap.get(e.label) ?? artistImageMap.get(e.label) ?? null,
  })).filter(c => c.imageUrl !== null).slice(0, 3)
  const topContext: MusicReportTopContext | null = top2Contexts[0] ?? null

  // Top tag
  const uniqueIds = [...new Set(tracks.map((t) => t.id))]
  const topTagEntry = tagStore ? aggregateTags(uniqueIds, tagStore)[0] : null
  const topTag = topTagEntry?.name ?? null

  // Totals
  const totalPlays = tracks.length
  const totalMinutes = Math.round(tracks.reduce((sum, t) => sum + t.durationMs, 0) / 60000)

  // Peak hour — convert UTC to CST (UTC+8)
  const hourMap = new Map<number, number>()
  for (const t of tracks) {
    const h = new Date(t.playedAt).getUTCHours()
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
  }
  const peakHourEntry = [...hourMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const peakHour = peakHourEntry ? (peakHourEntry[0] + 8) % 24 : null

  return { period, periodLabel, dateRange, topTrack, topArtist, top5Tracks, top5Artists, topContext, top2Contexts, topTag, totalPlays, totalMinutes, peakHour }
}

export async function buildMusicReport(): Promise<MusicReport> {
  const now = new Date()
  const todayStr = toYMD(now)
  const yearMonthStr = toYM(now)

  // Day: today's shard
  const dayTracksPromise = readRecentlyPlayedDayShard(todayStr)

  const weekDays = buildWeekDayKeys(todayStr).filter((day) => day <= todayStr)

  // Month: current month shards
  const monthDaysPromise = listRecentlyPlayedDays(31)

  // Dashboard for artist images
  const dashboardPromise = getStoredSpotifyDashboardData().catch(() => null)

  const [dayTracks, monthDays, dashboard] = await Promise.all([
    dayTracksPromise,
    monthDaysPromise,
    dashboardPromise,
  ])

  const weekShards = await Promise.all(weekDays.map((day) => readRecentlyPlayedDayShard(day)))
  const weekTracks = weekShards.flat()

  const currentMonthDays = monthDays.filter((d) => d.startsWith(yearMonthStr))
  const monthShards = await Promise.all(currentMonthDays.map((d) => readRecentlyPlayedDayShard(d)))
  const monthTracks = monthShards.flat()

  // Build artist name → imageUrl lookup from dashboard data across all time ranges
  const artistImageMap = new Map<string, string>()
  if (dashboard) {
    const allArtists = [
      ...(dashboard.topArtists?.short_term ?? []),
      ...(dashboard.topArtists?.medium_term ?? []),
      ...(dashboard.topArtists?.long_term ?? []),
    ]
    for (const a of allArtists) {
      if (a.imageUrl && !artistImageMap.has(a.name)) {
        artistImageMap.set(a.name, a.imageUrl)
      }
    }
  }

  // Build context label → imageUrl lookup from dashboard library (playlists + albums)
  const contextImageMap = new Map<string, string>()
  if (dashboard) {
    for (const p of dashboard.library?.playlists?.items ?? []) {
      if (p.imageUrl && p.name) contextImageMap.set(p.name, p.imageUrl)
    }
    for (const sa of dashboard.library?.savedAlbums?.items ?? []) {
      if (sa.album.imageUrl && sa.album.name) contextImageMap.set(sa.album.name, sa.album.imageUrl)
    }
  }

  // Fetch tags for all unique track IDs across all periods
  const allIds = [...new Set([...dayTracks, ...weekTracks, ...monthTracks].map((t) => t.id))]
  const tagStore = allIds.length > 0 ? await readSpotifyTrackTagStore() : null

  // Date range strings
  const dayRange = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  const weekStart = weekDays[0] ?? todayStr
  const weekRange = `${formatMonthDay(weekStart)}–${formatMonthDay(todayStr)}`
  const monthRange = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`

  return {
    day: computeStats(dayTracks, tagStore, artistImageMap, contextImageMap, 'day', '今天', dayRange),
    week: computeStats(weekTracks, tagStore, artistImageMap, contextImageMap, 'week', '本周', weekRange),
    month: computeStats(monthTracks, tagStore, artistImageMap, contextImageMap, 'month', '本月', monthRange),
    generatedAt: now.toISOString(),
  }
}
