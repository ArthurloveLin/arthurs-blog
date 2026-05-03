import { NextRequest, NextResponse } from 'next/server'
import { attachViewerEmojiReactions } from '@/lib/comment-emojis'
import { COMMENT_MAX_LENGTH } from '@/lib/input-limits'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserRole } from '@/lib/auth'

function trimTrailingSlash(value: string | undefined) {
  return value?.replace(/\/+$/, '') ?? ''
}

function getCommentWorkerUrl(path: string) {
  const baseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_ENGAGEMENT_WORKER_URL)
  if (!baseUrl) {
    return null
  }

  const url = new URL(baseUrl)
  const basePath = url.pathname === '/' ? '' : trimTrailingSlash(url.pathname)
  url.pathname = `${basePath}${path.startsWith('/') ? path : `/${path}`}`
  return url.toString()
}

async function tryPendingCommentMutation(path: string, method: 'PATCH' | 'DELETE', body: Record<string, unknown>) {
  const workerUrl = getCommentWorkerUrl(path)
  if (!workerUrl) {
    return null
  }

  const response = await fetch(workerUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (response.status === 404) {
    return null
  }

  if (method === 'DELETE' && response.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    return NextResponse.json(payload ?? { error: 'Pending comment mutation failed' }, { status: response.status })
  }

  return NextResponse.json(payload)
}

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

async function canModifyComment(author: string, body: Record<string, unknown>) {
  const role = await getUserRole()
  if (role === 'admin') {
    return true
  }

  const requesterIdentities = Array.isArray(body.identities)
    ? body.identities.filter((value: unknown): value is string => typeof value === 'string')
    : [body.identity].filter((value): value is string => typeof value === 'string')

  return requesterIdentities.includes(author)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const pendingMutationResponse = await tryPendingCommentMutation(`/api/comments/${id}`, 'DELETE', body)
  if (pendingMutationResponse) {
    return pendingMutationResponse
  }

  const comment = await getCommentById(id)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (!(await canModifyComment(comment.author, body))) {
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
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const pendingMutationResponse = await tryPendingCommentMutation(`/api/comments/${id}`, 'PATCH', body)
  if (pendingMutationResponse) {
    return pendingMutationResponse
  }

  const comment = await getCommentById(id)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const requesterIdentities = Array.isArray(body.identities)
    ? body.identities.filter((value: unknown): value is string => typeof value === 'string')
    : [body.identity].filter((value): value is string => typeof value === 'string')

  if (!content) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 })
  }

  if (content.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json({ error: 'Content too long' }, { status: 400 })
  }

  const role = await getUserRole()
  if (role !== 'admin' && !requesterIdentities.includes(comment.author)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update({ content })
    .eq('id', id)
    .select('id, author, content, created_at, updated_at, parent_id, upvotes, downvotes')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update comment' }, { status: 500 })
  }

  const [commentWithEmoji] = await attachViewerEmojiReactions([{ ...(data ?? {}), viewer_reaction: 0 }])
  return NextResponse.json(commentWithEmoji)
}
