import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { isAdminRequest } from '@/lib/auth'
import { syncSpotifyDashboardToArchive } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') as 'quick' | 'full' | null
  const headerList = await headers()
  const syncSecret = headerList.get('x-spotify-sync-secret')
  const isValidSecret = syncSecret && syncSecret === process.env.SPOTIFY_SYNC_SECRET

  if (!isValidSecret && !await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await syncSpotifyDashboardToArchive({ 
      mode: mode === 'quick' ? 'quick' : 'full' 
    })
    revalidatePath('/spotify')
    return NextResponse.json(result)
  } catch (error) {
    console.error('Spotify sync failed:', error)
    const message = error instanceof Error ? error.message : 'Spotify sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}