import { NextResponse } from 'next/server'
import { getLifeGalleryRound } from '@/lib/life-gallery'

export const revalidate = 300

export async function GET() {
  try {
    const round = await getLifeGalleryRound()

    return NextResponse.json(round, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Life Gallery round request failed:', error)

    return NextResponse.json(
      { error: 'Life Gallery 数据暂时不可用。' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  }
}