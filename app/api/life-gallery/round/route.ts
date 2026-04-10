import { NextResponse } from 'next/server'
import { getLifeGalleryRound } from '@/lib/life-gallery'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const round = await getLifeGalleryRound()

    return NextResponse.json(round, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Life Gallery round request failed:', error)

    return NextResponse.json(
      { error: 'Life Gallery 数据暂时不可用。' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  }
}