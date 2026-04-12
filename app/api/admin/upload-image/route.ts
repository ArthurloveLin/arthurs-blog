import { NextRequest, NextResponse } from 'next/server'
import { putR2Object } from '@/lib/r2'
import { isAdminRequest } from '@/lib/auth'

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!
const WARDROBE_PUBLIC_URL = process.env.R2_WARDROBE_PUBLIC_URL!
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 })
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image size must be 5MB or smaller' }, { status: 400 })
    }

    const fileId = crypto.randomUUID()
    const extensionByType: Record<string, string> = {
      'image/webp': 'webp',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/svg+xml': 'svg',
      'image/gif': 'gif',
      'image/avif': 'avif',
    }
    const extension = extensionByType[file.type] || file.name.split('.').pop() || 'webp'
    const imagePath = `site/${fileId}.${extension}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = file.type || 'image/webp'

    await putR2Object(WARDROBE_BUCKET, imagePath, buffer, contentType, {
      cacheControl: 'public, max-age=31536000, immutable',
    })

    const imageUrl = `https://${WARDROBE_PUBLIC_URL}/${imagePath}`

    return NextResponse.json({ url: imageUrl }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
