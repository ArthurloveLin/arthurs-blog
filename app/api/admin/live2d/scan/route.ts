import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { listR2Objects } from '@/lib/r2'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bucket = process.env.R2_CDN_BUCKET
  const domain = process.env.R2_CDN_PUBLIC_DOMAIN

  if (!bucket || !domain) {
    return NextResponse.json({ error: 'CDN bucket not configured. Please check R2_CDN_BUCKET and R2_CDN_PUBLIC_DOMAIN.' }, { status: 500 })
  }

  try {
    // List all objects from the CDN bucket.
    // In the future, we can encourage moving models to a 'live2d/' prefix for better performance.
    const keys = await listR2Objects(bucket)
    
    // Filter for all model.json files (including those in subdirectories like normal/model.json)
    const modelFiles = keys.filter(key => key.endsWith('model.json'))
    
    const results = modelFiles.map(key => {
      // Extract a name from the path.
      // e.g. "live2d/ots14_3001/destroy/model.json" -> "live2d/ots14_3001/destroy"
      const parts = key.split('/')
      let name = ''
      if (parts.length > 1) {
          // If in a folder, use the folder path (excluding 'model.json') as the name
          name = parts.slice(0, -1).join('/')
      } else {
          // If in root, remove the extension
          name = key.replace(/\.model\.json$|model\.json$/i, '')
      }

      return {
        id: `scanned-${key}`,
        name: `${name} (扫码发现)`,
        url: `https://${domain}/${key}`,
        key: key
      }
    })

    // Sort alphabetically by name
    results.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ models: results })
  } catch (error) {
    console.error('Live2D Scan Error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
