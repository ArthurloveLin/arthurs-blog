import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { upsertSiteConfig, getSiteConfig } from '@/lib/blog'
import { revalidateTag } from 'next/cache'

export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const config = await getSiteConfig()
  return NextResponse.json(config)
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    // Validation
    if (typeof body !== 'object' || !body) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const entries: Record<string, string> = {}
    
    // Allowed keys
    const allowedKeys = [
      'author_name',
      'author_bio',
      'author_avatar_url',
      'author_role',
      'author_company',
      'author_location',
      'author_skills',
      'author_status',
      'author_github',
      'author_linkedin',
      'author_weibo',
      'author_wechat',
      'author_email',
      'site_subtitle',
      'site_title_highlight',
      'site_title_highlight_2',
      'site_title_rest',
      'site_description'
    ]

    for (const key of allowedKeys) {
      if (typeof body[key] === 'string') {
        entries[key] = body[key]
      }
    }

    if (Object.keys(entries).length > 0) {
      await upsertSiteConfig(entries)
    }

    revalidateTag('site-config', 'max')

    return NextResponse.json({ success: true, updated: Object.keys(entries) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
