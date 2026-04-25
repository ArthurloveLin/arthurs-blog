import { NextResponse } from 'next/server'

import { buildMusicReport } from '@/lib/spotify-report'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const report = await buildMusicReport()
    return NextResponse.json(report, {
      headers: {
        // Day section is volatile, so short cache; week/month are recomputed anyway server-side
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Failed to build music report:', error)
    return NextResponse.json({ error: 'Failed to build music report' }, { status: 500 })
  }
}
