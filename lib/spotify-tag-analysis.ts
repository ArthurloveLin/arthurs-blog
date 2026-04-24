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
  '电子 / 舞曲': ['electronic', 'edm', 'dance', 'techno', 'house', 'electropop', 'synth-pop', 'synth pop', 'ambient', 'electronica', 'idm', 'trance'],
  '摇滚 / 另类': ['rock', 'indie', 'alternative', 'punk', 'post-rock', 'indie rock', 'alternative rock', 'shoegaze', 'grunge', 'emo', 'post-punk'],
  '流行':        ['pop', 'k-pop', 'j-pop', 'dream pop', 'synth pop', 'power pop', 'chamber pop', 'art pop', 'indie pop'],
  '嘻哈 / R&B':  ['hip-hop', 'hip hop', 'r&b', 'rap', 'soul', 'rnb', 'trap', 'urban', 'neo-soul'],
  '情绪 / 氛围':  ['chill', 'melancholic', 'sad', 'happy', 'romantic', 'relaxing', 'atmospheric', 'chillout', 'lo-fi', 'lofi'],
  '原声 / 民谣':  ['acoustic', 'folk', 'singer-songwriter', 'country', 'americana', 'bluegrass', 'celtic'],
  '古典 / 爵士':  ['classical', 'jazz', 'orchestral', 'piano', 'instrumental', 'blues', 'swing', 'bossa nova'],
  '金属 / 硬核':  ['metal', 'heavy metal', 'hard rock', 'hardcore', 'metalcore', 'death metal', 'black metal', 'thrash'],
}

function aggregateTags(trackIds: string[], store: SpotifyTrackTagStore): TagAggregation[] {
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

function computeRadarAxes(aggregations: TagAggregation[]): TagRadarAxis[] {
  const tagMap = new Map(aggregations.map((t) => [t.name, t.totalCount]))

  const rawScores: Record<string, number> = {}
  for (const [label, keywords] of Object.entries(RADAR_CLUSTERS)) {
    rawScores[label] = keywords.reduce((sum, kw) => sum + (tagMap.get(kw) ?? 0), 0)
  }

  const max = Math.max(...Object.values(rawScores), 1)
  return Object.entries(rawScores).map(([label, raw]) => ({
    label,
    score: Math.round((raw / max) * 100),
  }))
}

function computeSectionResult(trackIds: string[], store: SpotifyTrackTagStore): SpotifyTagSectionResult {
  const tracksWithTags = trackIds.filter((id) => !!store.tracks[id]).length
  const topTags = aggregateTags(trackIds, store)
  const radarAxes = computeRadarAxes(topTags)
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
