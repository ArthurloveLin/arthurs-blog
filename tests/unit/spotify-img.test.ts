import { describe, it, expect } from 'vitest'

import { spotifyImg } from '@/lib/spotify-img'

describe('spotifyImg', () => {
  it('returns null for falsy input', () => {
    expect(spotifyImg(null)).toBeNull()
    expect(spotifyImg(undefined)).toBeNull()
    expect(spotifyImg('')).toBeNull()
  })

  it('routes a real url through the proxy with the url query-encoded', () => {
    const src = 'https://i.scdn.co/image/ab67616d00001e02?x=1&y=2'
    expect(spotifyImg(src)).toBe(
      `https://img.arthurlovegrace.top/spotify?url=${encodeURIComponent(src)}`,
    )
  })
})
