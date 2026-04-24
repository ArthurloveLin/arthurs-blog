import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { isAdminRequest } from '@/lib/auth'
import { readSpotifyTagCandidatesFromArchive } from '@/lib/spotify'
import { syncSpotifyTrackTags } from '@/lib/spotify-tags'

export const dynamic = 'force-dynamic'
// Last.fm 请求密集，给足超时时间（Vercel 默认 300s 够用）
export const maxDuration = 300

export async function POST(request: Request) {
  const headerList = await headers()
  const syncSecret = headerList.get('x-spotify-sync-secret')
  const isValidSecret = syncSecret && syncSecret === process.env.SPOTIFY_SYNC_SECRET

  if (!isValidSecret && !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { bucket, candidates } = await readSpotifyTagCandidatesFromArchive()

    if (!bucket) {
      return NextResponse.json({ error: 'Spotify archive not configured' }, { status: 503 })
    }

    const result = await syncSpotifyTrackTags({
      bucket,
      tracks: candidates,
    })

    return NextResponse.json({
      tagsUpdated: result.tagsUpdated,
      pending: candidates.length,
      warnings: result.warnings,
    })
  } catch (error) {
    console.error('Tag sync failed:', error)
    const message = error instanceof Error ? error.message : 'Tag sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
