import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { putR2Object } from '@/lib/r2'

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!
const WARDROBE_PUBLIC_URL = process.env.R2_WARDROBE_PUBLIC_URL!
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 })
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be 10MB or smaller' }, { status: 400 })
    }

    const extensionMap: Record<string, string> = {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/avif': 'avif',
    }
    const ext = extensionMap[file.type] ?? 'webp'
    const key = `memo-images/${crypto.randomUUID()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await putR2Object(WARDROBE_BUCKET, key, buffer, file.type, {
      cacheControl: 'public, max-age=31536000, immutable',
    })

    const url = `https://${WARDROBE_PUBLIC_URL}/${key}`
    return NextResponse.json({ url }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
