import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserRole } from '@/lib/auth'

async function getCommentById(id: string) {
  const { data: comment, error } = await supabaseAdmin
    .from('comments')
    .select('id, author')
    .eq('id', id)
    .single()

  if (error || !comment) {
    return null
  }

  return comment
}

async function canModifyComment(req: NextRequest, author: string) {
  const role = await getUserRole()
  if (role === 'admin') {
    return true
  }

  const body = await req.json().catch(() => ({}))
  const requesterIdentity = body.identity as string | undefined
  return !!requesterIdentity && requesterIdentity === author
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const comment = await getCommentById(id)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (!(await canModifyComment(req, comment.author))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const comment = await getCommentById(id)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const requesterIdentity = typeof body.identity === 'string' ? body.identity : undefined

  if (!content) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 })
  }

  const role = await getUserRole()
  if (role !== 'admin' && (!requesterIdentity || requesterIdentity !== comment.author)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update({ content })
    .eq('id', id)
    .select('id, author, content, created_at, updated_at, parent_id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update comment' }, { status: 500 })
  }

  return NextResponse.json(data)
}
