import { NextRequest, NextResponse } from 'next/server'
import { putR2Object } from '@/lib/r2'
import { isAdminRequest } from '@/lib/auth'

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!
const WARDROBE_PUBLIC_URL = process.env.R2_WARDROBE_PUBLIC_URL!

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const fileId = crypto.randomUUID()
  // Keep the original extension or fallback
  const extension = file.name.split('.').pop() || 'webp'
  const imagePath = `site/${fileId}.${extension}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  // We determine content type heuristically or fallback
  let contentType = file.type || 'image/webp'
  if (extension === 'png') contentType = 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg'
  if (extension === 'svg') contentType = 'image/svg+xml'

  await putR2Object(WARDROBE_BUCKET, imagePath, buffer, contentType)

  const imageUrl = `https://${WARDROBE_PUBLIC_URL}/${imagePath}`

  return NextResponse.json({ url: imageUrl }, { status: 201 })
}
