import { NextResponse } from 'next/server'

import { listRecentlyPlayedDays } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const days = await listRecentlyPlayedDays()

    return NextResponse.json(
      { days },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Failed to list Spotify history day shards:', error)
    const message = error instanceof Error ? error.message : 'Failed to list Spotify history days'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}