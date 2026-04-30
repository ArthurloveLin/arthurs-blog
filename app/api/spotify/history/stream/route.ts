import { NextResponse } from 'next/server'
import { getR2Object } from '@/lib/r2'

export const dynamic = 'force-dynamic'

function getBucket() {
  const bucket = process.env.R2_SPOTIFY_BUCKET
  if (!bucket) throw new Error('Missing R2_SPOTIFY_BUCKET')
  return bucket
}

export async function GET() {
  try {
    const bucket = getBucket()
    const raw = await getR2Object(bucket, 'spotify/history/stream.json')
    const data = JSON.parse(raw)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=3600'
      }
    })
  } catch (error: unknown) {
    console.error('Failed to fetch stream data:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
