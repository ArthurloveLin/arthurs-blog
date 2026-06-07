import { describe, it, expect } from 'vitest'

import { aggregateTags } from '@/lib/spotify-tag-analysis'
import type { SpotifyTrackTagStore } from '@/lib/spotify-types'

const store = (tracks: Record<string, { name: string; count: number }[]>) =>
  ({ tracks: Object.fromEntries(Object.entries(tracks).map(([id, tags]) => [id, { tags }])) } as unknown as SpotifyTrackTagStore)

describe('aggregateTags', () => {
  it('merges tags case-insensitively, sums counts, and sorts by total desc', () => {
    const s = store({
      a: [{ name: 'Pop', count: 3 }, { name: 'Rock', count: 1 }],
      b: [{ name: 'pop', count: 2 }],
    })
    expect(aggregateTags(['a', 'b', 'missing-id'], s)).toEqual([
      { name: 'pop', totalCount: 5, trackCount: 2 },
      { name: 'rock', totalCount: 1, trackCount: 1 },
    ])
  })

  it('ignores track ids that are absent from the store', () => {
    expect(aggregateTags(['nope'], store({ a: [{ name: 'jazz', count: 1 }] }))).toEqual([])
  })

  it('caps the result at the top 60 tags', () => {
    const tags = Array.from({ length: 61 }, (_, i) => ({ name: `tag${i}`, count: i + 1 }))
    expect(aggregateTags(['a'], store({ a: tags }))).toHaveLength(60)
  })
})
