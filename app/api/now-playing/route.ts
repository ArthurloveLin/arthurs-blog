import { NextResponse } from 'next/server'

import {
  getSpotifyNowPlayingCacheControl,
  getSpotifyNowPlayingErrorCacheControl,
} from '@/lib/spotify-now-playing'
import { getSpotifyNowPlayingData } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getSpotifyNowPlayingData()
    const payload = data ?? { isPlaying: false }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': getSpotifyNowPlayingCacheControl(data, { shared: true }),
      },
    })
  } catch (error) {
    console.error('Failed to load Spotify now playing data:', error)
    return NextResponse.json({ isPlaying: false }, {
      headers: {
        'Cache-Control': getSpotifyNowPlayingErrorCacheControl({ shared: true }),
      },
    })
  }
}
