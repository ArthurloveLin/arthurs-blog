import type {
  SpotifyDashboardData,
  SpotifyTagSection,
  SpotifyTagAnalysis,
  SpotifyTagSectionResult,
  TagAggregation,
  TagRadarAxis,
  SpotifyTrackTagStore,
} from './spotify-types'

const RADAR_CLUSTERS: Record<string, string[]> = {
  '流行': ['pop', 'k-pop', 'j-pop', 'dream pop', 'synth pop', 'power pop', 'chamber pop', 'art pop', 'indie pop'],
  '摇滚': ['rock', 'indie', 'alternative', 'punk', 'post-rock', 'indie rock', 'alternative rock', 'shoegaze', 'grunge', 'emo', 'post-punk', 'metal', 'heavy metal'],
  'R&B': ['r&b', 'rnb', 'soul', 'neo-soul'],
  '电子': ['electronic', 'edm', 'dance', 'techno', 'house', 'electropop', 'ambient', 'electronica', 'idm', 'trance'],
  '民谣': ['acoustic', 'folk', 'singer-songwriter', 'country', 'americana', 'bluegrass', 'celtic'],
  '古典': ['classical', 'orchestral', 'piano', 'instrumental'],
  '嘻哈': ['hip-hop', 'hip hop', 'rap', 'trap', 'urban'],
  '爵士': ['jazz', 'blues', 'swing', 'bossa nova'],
}

export function aggregateTags(trackIds: string[], store: SpotifyTrackTagStore): TagAggregation[] {
  const map = new Map<string, { totalCount: number; trackCount: number }>()

  for (const id of trackIds) {
    const entry = store.tracks[id]
    if (!entry) continue
    for (const tag of entry.tags) {
      const key = tag.name.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.totalCount += tag.count
        existing.trackCount += 1
      } else {
        map.set(key, { totalCount: tag.count, trackCount: 1 })
      }
    }
  }

  return Array.from(map.entries())
    .map(([name, { totalCount, trackCount }]) => ({ name, totalCount, trackCount }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 60)
}

function computeRadarAxes(aggregations: TagAggregation[], trackIds: string[], store: SpotifyTrackTagStore): TagRadarAxis[] {
  const tagMap = new Map(aggregations.map((t) => [t.name, t.totalCount]))

  const rawScores: Record<string, number> = {}
  const clusterTrackCounts: Record<string, number> = {}
  for (const [label, keywords] of Object.entries(RADAR_CLUSTERS)) {
    rawScores[label] = keywords.reduce((sum, kw) => sum + (tagMap.get(kw) ?? 0), 0)
    const kwSet = new Set(keywords)
    let count = 0
    for (const id of trackIds) {
      const entry = store.tracks[id]
      if (entry?.tags.some((t) => kwSet.has(t.name.toLowerCase()))) count++
    }
    clusterTrackCounts[label] = count
  }

  const max = Math.max(...Object.values(rawScores), 1)
  return Object.entries(rawScores).map(([label, raw]) => ({
    label,
    score: Math.round((raw / max) * 100),
    trackCount: clusterTrackCounts[label],
  }))
}

function computeSectionResult(trackIds: string[], store: SpotifyTrackTagStore): SpotifyTagSectionResult {
  const tracksWithTags = trackIds.filter((id) => !!store.tracks[id]).length
  const topTags = aggregateTags(trackIds, store)
  const radarAxes = computeRadarAxes(topTags, trackIds, store)
  return { topTags, radarAxes, tracksWithTags }
}

export function computeTagAnalysis(data: SpotifyDashboardData, store: SpotifyTrackTagStore): SpotifyTagAnalysis {
  const sections: Record<SpotifyTagSection, string[]> = {
    short_term: data.topTracks.short_term.map((t) => t.id),
    medium_term: data.topTracks.medium_term.map((t) => t.id),
    long_term: data.topTracks.long_term.map((t) => t.id),
    saved: data.library.savedTracks.items.map((s) => s.track.id),
    recent: data.recentlyPlayed.map((t) => t.id),
  }

  return Object.fromEntries(
    (Object.entries(sections) as [SpotifyTagSection, string[]][]).map(([section, ids]) => [
      section,
      computeSectionResult(ids, store),
    ])
  ) as SpotifyTagAnalysis
}
