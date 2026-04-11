import { getR2ObjectBuffer } from '@/lib/r2'

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}

function getContentType(key: string) {
  const extensionIndex = key.lastIndexOf('.')
  if (extensionIndex === -1) {
    return 'application/octet-stream'
  }

  return IMAGE_CONTENT_TYPES[key.slice(extensionIndex).toLowerCase()] ?? 'application/octet-stream'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await params
  const key = segments.join('/')

  if (!key.startsWith('Gallery/')) {
    return new Response('Invalid gallery key.', { status: 400 })
  }

  const bucket = process.env.R2_BLOG_BUCKET
  if (!bucket) {
    return new Response('Life Gallery is not configured.', { status: 500 })
  }

  try {
    const body = await getR2ObjectBuffer(bucket, key)
    const bytes = new Uint8Array(body)

    return new Response(bytes, {
      headers: {
        'Content-Type': getContentType(key),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to proxy Life Gallery image:', error)

    return new Response('Unable to load Life Gallery image.', { status: 404 })
  }
}