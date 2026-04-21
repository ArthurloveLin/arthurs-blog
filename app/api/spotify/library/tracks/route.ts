import { NextResponse } from 'next/server'
import { readSpotifyCollection, SPOTIFY_SAVED_TRACKS_KEY } from '@/lib/spotify'
import type { SpotifySavedTrack } from '@/lib/spotify-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const collection = await readSpotifyCollection<SpotifySavedTrack>(SPOTIFY_SAVED_TRACKS_KEY)
    
    return NextResponse.json(collection.items, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to load saved tracks:', error)
    return NextResponse.json({ error: 'Failed to load tracks' }, { status: 500 })
  }
}
