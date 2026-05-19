import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNtfy } from '@/lib/ntfy'
import { verifyTurnstile } from '@/lib/turnstile'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : ''

  if (!name || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? undefined
  const valid = await verifyTurnstile(turnstileToken, ip)
  if (!valid) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
  }

  const content = email ? `${message}\n\n📧 ${email}` : message
  const { error } = await supabaseAdmin
    .from('comments')
    .insert({
      target_type: 'contact',
      target_id: '00000000-0000-0000-0000-000000000001',
      author: name,
      content,
      visibility: 'admin_only',
    })

  if (error) {
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  sendNtfy('blog-contact', `新联系消息 from ${name}`, message.slice(0, 200), {
    priority: 5,
    tags: ['envelope'],
  }).catch(() => {})

  return NextResponse.json({ success: true }, { status: 201 })
}
