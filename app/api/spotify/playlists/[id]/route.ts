import { NextResponse } from 'next/server'
import { readSpotifyPlaylistShard } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing playlist ID' }, { status: 400 })
  }

  try {
    const tracks = await readSpotifyPlaylistShard(id)
    
    return NextResponse.json(tracks, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error(`Failed to load playlist shard ${id}:`, error)
    return NextResponse.json({ error: 'Failed to load tracks' }, { status: 500 })
  }
}
