import { NextRequest, NextResponse } from 'next/server'
import { getPublicComments } from '@/lib/comments-server'
import { COMMENT_MAX_LENGTH } from '@/lib/input-limits'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const target_type = searchParams.get('target_type')
  const target_id = searchParams.get('target_id')

  if (!target_type || !target_id) {
    return NextResponse.json({ error: 'Missing target_type or target_id' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getPublicComments(target_type, target_id))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load comments' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const { target_type, target_id, author, content, parent_id } = await req.json() as Record<string, unknown>
  const nextAuthor = typeof author === 'string' ? author.trim() : ''
  const nextContent = typeof content === 'string' ? content.trim() : ''

  if (!target_type || !target_id || !nextAuthor || !nextContent) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (nextContent.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json({ error: 'Content too long' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      target_type,
      target_id,
      ...(target_type === 'wardrobe_item' ? { item_id: target_id } : {}),
      author: nextAuthor,
      content: nextContent,
      parent_id: parent_id ?? null,
    })
    .select('id, author, content, created_at, updated_at, parent_id, upvotes, downvotes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...(data ?? {}), viewer_reaction: 0, emoji_reactions: [], viewer_emojis: [] }, { status: 201 })
}
