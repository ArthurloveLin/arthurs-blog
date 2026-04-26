import 'server-only'

import { aggregateTags } from './spotify-tag-analysis'
import { getStoredSpotifyDashboardData, listRecentlyPlayedDays, readRecentlyPlayedDayShard } from './spotify'
import { readSpotifyTrackTagStore } from './spotify-tags'
import type { SpotifyRecentlyPlayedTrack, SpotifyTrackTagStore } from './spotify-types'

export interface MusicReportTopTrack {
  title: string
  artist: string
  albumImageUrl: string | null
  playCount: number
  durationMs: number
}

export interface MusicReportTopArtist {
  name: string
  playCount: number
  imageUrl: string | null
}

export interface MusicReportTopContext {
  label: string
  type: string
  playCount: number
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

function computeStats(
  tracks: SpotifyRecentlyPlayedTrack[],
  tagStore: SpotifyTrackTagStore | null,
  artistImageMap: Map<string, string>,
  period: 'day' | 'week' | 'month',
  periodLabel: string,
  dateRange: string
): MusicReportStats {
  if (tracks.length === 0) {
    return { period, periodLabel, dateRange, topTrack: null, topArtist: null, top5Tracks: [], top5Artists: [], topContext: null, topTag: null, totalPlays: 0, totalMinutes: 0, peakHour: null }
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
    imageUrl: artistImageMap.get(name) ?? null,
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
  const topContextEntry = [...ctxMap.values()].sort((a, b) => b.count - a.count)[0]
  const topContext: MusicReportTopContext | null = topContextEntry
    ? { label: topContextEntry.label, type: topContextEntry.type, playCount: topContextEntry.count }
    : null

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

  return { period, periodLabel, dateRange, topTrack, topArtist, top5Tracks, top5Artists, topContext, topTag, totalPlays, totalMinutes, peakHour }
}

export async function buildMusicReport(): Promise<MusicReport> {
  const now = new Date()
  const todayStr = toYMD(now)
  const yearMonthStr = toYM(now)

  // Day: today's shard
  const dayTracksPromise = readRecentlyPlayedDayShard(todayStr)

  // Week: last 7 day shards merged
  const daysPromise = listRecentlyPlayedDays(7)

  // Month: current month shards
  const monthDaysPromise = listRecentlyPlayedDays(31)

  // Dashboard for artist images
  const dashboardPromise = getStoredSpotifyDashboardData().catch(() => null)

  const [dayTracks, days, monthDays, dashboard] = await Promise.all([
    dayTracksPromise,
    daysPromise,
    monthDaysPromise,
    dashboardPromise,
  ])

  const weekShards = await Promise.all(days.map((d) => readRecentlyPlayedDayShard(d)))
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

  // Fetch tags for all unique track IDs across all periods
  const allIds = [...new Set([...dayTracks, ...weekTracks, ...monthTracks].map((t) => t.id))]
  const tagStore = allIds.length > 0 ? await readSpotifyTrackTagStore() : null

  // Date range strings
  const dayRange = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  const weekStart = days[days.length - 1] ?? todayStr
  const [, , wsd] = weekStart.split('-')
  const [, , wed] = todayStr.split('-')
  const weekRange = `${String(now.getMonth() + 1).padStart(2, '0')}/${wsd}–${wed}`
  const monthRange = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`

  return {
    day: computeStats(dayTracks, tagStore, artistImageMap, 'day', '今天', dayRange),
    week: computeStats(weekTracks, tagStore, artistImageMap, 'week', '本周', weekRange),
    month: computeStats(monthTracks, tagStore, artistImageMap, 'month', '本月', monthRange),
    generatedAt: now.toISOString(),
  }
}
