import { NextRequest, NextResponse } from 'next/server'
import { deleteR2Object } from '@/lib/r2'
import { isAdminRequest } from '@/lib/auth'

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { key } = await request.json()
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    await deleteR2Object(WARDROBE_BUCKET, key)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
