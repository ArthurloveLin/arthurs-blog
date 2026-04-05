import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserRole } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Fetch the comment to check authorship
  const { data: comment, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('author')
    .eq('id', id)
    .single()

  if (fetchError || !comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  // Allow delete if requester is admin or the comment author
  const role = await getUserRole()
  if (role === 'admin') {
    // admin can delete anything
  } else {
    // non-admin: must supply their identity in the request body
    const body = await req.json().catch(() => ({}))
    const requesterIdentity = body.identity as string | undefined
    if (!requesterIdentity || requesterIdentity !== comment.author) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin.from('comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
