import { describe, it, expect } from 'vitest'

import {
  getSpotifyNowPlayingCacheControl,
  getSpotifyNowPlayingErrorCacheControl,
} from '../../workers/spotify-now-playing-worker/src/now-playing-cache'
import type { SpotifyNowPlayingData } from '../../workers/spotify-now-playing-worker/src/spotify-types'

// Only isPlaying/durationMs/progressMs are read by the cache-control logic.
const np = (over: Partial<SpotifyNowPlayingData>) => over as unknown as SpotifyNowPlayingData

describe('getSpotifyNowPlayingCacheControl', () => {
  it('uses the short idle TTL with SWR when nothing is playing', () => {
    const cc = getSpotifyNowPlayingCacheControl(null)
    expect(cc).toContain('s-maxage=5')
    expect(cc).toContain('stale-while-revalidate=5')
    // isPlaying:false collapses to the same idle policy
    expect(getSpotifyNowPlayingCacheControl(np({ isPlaying: false }))).toBe(cc)
  })

  it('falls back to idle when playing but duration/progress are unknown', () => {
    const cc = getSpotifyNowPlayingCacheControl(np({ isPlaying: true }))
    expect(cc).toContain('s-maxage=5')
    expect(cc).toContain('stale-while-revalidate=5')
  })

  it('uses the standard 15s TTL with SWR when far from the track end', () => {
    const cc = getSpotifyNowPlayingCacheControl(np({ isPlaying: true, durationMs: 200_000, progressMs: 100_000 }))
    expect(cc).toContain('s-maxage=15')
    expect(cc).toContain('stale-while-revalidate=5')
  })

  it('disables SWR inside the 12s near-end window (avoids a stale "playing" state)', () => {
    const cc = getSpotifyNowPlayingCacheControl(np({ isPlaying: true, durationMs: 200_000, progressMs: 192_000 })) // 8s left
    expect(cc).toContain('s-maxage=5')
    expect(cc).not.toContain('stale-while-revalidate')
  })

  it('sets the near-end TTL to ceil(remaining seconds), clamped to 1..5', () => {
    // 3000ms left → ceil(3) = 3
    expect(getSpotifyNowPlayingCacheControl(np({ isPlaying: true, durationMs: 10_000, progressMs: 7_000 })))
      .toContain('s-maxage=3')
    // 0ms left → clamped up to the 1s floor
    expect(getSpotifyNowPlayingCacheControl(np({ isPlaying: true, durationMs: 10_000, progressMs: 10_000 })))
      .toContain('s-maxage=1')
    // 11000ms left → ceil(11) clamped down to the 5s ceiling
    expect(getSpotifyNowPlayingCacheControl(np({ isPlaying: true, durationMs: 20_000, progressMs: 9_000 })))
      .toContain('s-maxage=5')
  })
})

describe('getSpotifyNowPlayingErrorCacheControl', () => {
  it('uses a 10s TTL with no SWR', () => {
    const cc = getSpotifyNowPlayingErrorCacheControl()
    expect(cc).toContain('s-maxage=10')
    expect(cc).not.toContain('stale-while-revalidate')
  })
})
