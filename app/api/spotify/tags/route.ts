import { NextRequest, NextResponse } from 'next/server'

import { filterSpotifyTrackTagStore, readSpotifyTrackTagStore } from '@/lib/spotify-tags'

export const dynamic = 'force-dynamic'

function parseIds(value: string | null) {
  return Array.from(new Set(
    (value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  ))
}

export async function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get('ids'))

  try {
    const store = await readSpotifyTrackTagStore()
    return NextResponse.json(filterSpotifyTrackTagStore(store, ids), {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to load Spotify tag data:', error)
    return NextResponse.json({ error: 'Failed to load Spotify tag data' }, { status: 500 })
  }
}
