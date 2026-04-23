import { NextResponse } from 'next/server'

import { readRecentlyPlayedDayShard } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

const DAY_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function getTodayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date || !DAY_QUERY_PATTERN.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  try {
    const tracks = await readRecentlyPlayedDayShard(date)

    return NextResponse.json(tracks, {
      headers: {
        'Cache-Control': date === getTodayKey()
          ? 's-maxage=60, stale-while-revalidate=300'
          : 's-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to read Spotify history day shard:', error)
    const message = error instanceof Error ? error.message : 'Failed to read Spotify history'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}