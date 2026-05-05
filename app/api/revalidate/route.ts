import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { purgeCloudflareFiles } from '@/lib/cloudflare-cache'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Validate secret
  if (secret !== process.env.SPOTIFY_SYNC_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
  }

  // Revalidate Spotify cache tags
  revalidateTag('spotify', 'max')
  await purgeCloudflareFiles(new URL(request.url).origin, ['/spotify'])
  
  return NextResponse.json({ revalidated: true, now: Date.now() })
}
