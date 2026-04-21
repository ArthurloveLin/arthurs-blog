import { NextResponse } from 'next/server'

import { getSpotifyNowPlayingData } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getSpotifyNowPlayingData()

    if (!data) {
      return NextResponse.json({ isPlaying: false })
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45',
      },
    })
  } catch (error) {
    console.error('Failed to load Spotify now playing data:', error)
    return NextResponse.json({ isPlaying: false }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10',
      },
    })
  }
}
