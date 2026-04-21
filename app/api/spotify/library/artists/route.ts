import { NextResponse } from 'next/server'
import { readSpotifyCollection, SPOTIFY_FOLLOWED_ARTISTS_KEY } from '@/lib/spotify'
import type { SpotifyFollowedArtist } from '@/lib/spotify-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const collection = await readSpotifyCollection<SpotifyFollowedArtist>(SPOTIFY_FOLLOWED_ARTISTS_KEY)
    
    return NextResponse.json(collection.items, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to load followed artists:', error)
    return NextResponse.json({ error: 'Failed to load artists' }, { status: 500 })
  }
}
