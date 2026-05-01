import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { upsertSiteConfig, getSiteConfig } from '@/lib/blog'
import { SPOTIFY_SITE_CONFIG_KEYS } from '@/lib/spotify-page-copy'
import { revalidateTag, revalidatePath } from 'next/cache'

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
    const rawBody = await request.json()
    if (typeof rawBody !== 'object' || !rawBody) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const body = rawBody as Record<string, unknown>

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
      'site_description',
      'site_slogan_1',
      'site_slogan_2',
      'memo_hero_subtitle',
      'memo_hero_title_highlight',
      'memo_hero_title_highlight_2',
      'memo_hero_title_rest',
      'memo_hero_description',
      'memo_slogan_1',
      'memo_slogan_2',
      'guestbook_hero_subtitle',
      'guestbook_hero_title_highlight',
      'guestbook_hero_title_highlight_2',
      'guestbook_hero_title_rest',
      'guestbook_hero_description',
      'guestbook_slogan_1',
      'guestbook_slogan_2',
      'news_hero_subtitle',
      'news_hero_title_highlight',
      'news_hero_title_highlight_2',
      'news_hero_title_rest',
      'news_hero_description',
      'news_slogan_1',
      'news_slogan_2',
      ...SPOTIFY_SITE_CONFIG_KEYS,
      'live2d_model_url',
      'live2d_engine_js_url',
      'live2d_canvas_width',
      'live2d_canvas_height'
    ]

    for (const key of allowedKeys) {
      if (typeof body[key] === 'string') {
        entries[key] = body[key] as string
      }
    }

    if (Object.keys(entries).length > 0) {
      await upsertSiteConfig(entries)
    }

    revalidateTag('site-config', 'max')
    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true, updated: Object.keys(entries) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
