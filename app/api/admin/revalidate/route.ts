import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { isAdminRequest } from '@/lib/auth'

const KNOWN_TAGS = ['recipes', 'posts', 'categories', 'tags'] as const

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tags }: { tags?: string[] } = await request.json().catch(() => ({}))
  const toRevalidate = tags?.length ? tags : [...KNOWN_TAGS]

  for (const tag of toRevalidate) {
    revalidateTag(tag, 'max')
  }

  return NextResponse.json({ revalidated: toRevalidate })
}
