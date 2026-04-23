import { NextRequest, NextResponse } from 'next/server'
import { readSpotifyCollection, SPOTIFY_SAVED_TRACKS_KEY } from '@/lib/spotify'
import type { SpotifySavedTrack } from '@/lib/spotify-types'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 72
const MAX_LIMIT = 120

function parseSearchParam(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return Math.floor(parsed)
}

export async function GET(request: NextRequest) {
  try {
    const collection = await readSpotifyCollection<SpotifySavedTrack>(SPOTIFY_SAVED_TRACKS_KEY)
    const offset = parseSearchParam(request.nextUrl.searchParams.get('offset'), 0)
    const limit = Math.min(parseSearchParam(request.nextUrl.searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT)
    const items = collection.items.slice(offset, offset + limit)
    
    return NextResponse.json({ items, total: collection.total }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to load saved tracks:', error)
    return NextResponse.json({ error: 'Failed to load tracks' }, { status: 500 })
  }
}
