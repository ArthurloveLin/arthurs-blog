import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNtfyReminder } from '@/lib/ntfy'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arthurlovegrace.top'
const REMINDER_TOKEN = process.env.REMINDER_CHECK_TOKEN

const INLINE_DUE_CAPTURE = /@due\[([^\]]*)\]\(([^)]*)\)/g

function parseInlineDueTags(content: string): Array<{ label: string; iso: string }> {
  const result: Array<{ label: string; iso: string }> = []
  INLINE_DUE_CAPTURE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_DUE_CAPTURE.exec(content)) !== null) {
    const iso = match[2]
    if (iso && !isNaN(Date.parse(iso))) result.push({ label: match[1], iso })
  }
  return result
}

function formatDueTime(iso: string, now: Date): string {
  const due = new Date(iso)
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', ...opts }).format(d)
  const sameDay = fmt(due, { year: 'numeric', month: 'numeric', day: 'numeric' }) ===
    fmt(now, { year: 'numeric', month: 'numeric', day: 'numeric' })
  if (sameDay) {
    return fmt(due, { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return fmt(due, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function buildNotification(
  due: { label: string; iso: string },
  content: string,
  now: Date,
): { title: string; body: string } {
  const label = due.label.trim() || 'Memo 提醒'
  const title = `⏰ ${label}`
  const snippet = content
    .replace(INLINE_DUE_CAPTURE, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 60)
  const timeStr = formatDueTime(due.iso, now)
  const body = `${snippet ? `${snippet}\n` : ''}截止 ${timeStr}`
  return { title, body }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (REMINDER_TOKEN && token !== REMINDER_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const nowIso = now.toISOString()

  // Fetch all non-archived memos that have inline @due tags or a due_at column set
  const { data: memos, error } = await supabaseAdmin
    .from('comments')
    .select('id, author, content, due_at, notified_at, notified_dues')
    .eq('target_type', 'memo')
    .eq('archived', false)
    .or(`content.like.%@due[%,and(due_at.lte.${nowIso},notified_at.is.null)`)
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!memos || memos.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  const errors: string[] = []

  for (const memo of memos) {
    const inlineTags = parseInlineDueTags(memo.content)

    if (inlineTags.length > 0) {
      // Multi-tag path: notify each past-due tag not yet in notified_dues
      const notifiedDues: string[] = Array.isArray(memo.notified_dues) ? memo.notified_dues : []
      const pending = inlineTags.filter(
        (t) => new Date(t.iso) <= now && !notifiedDues.includes(t.iso),
      )

      for (const due of pending) {
        try {
          const { title, body } = buildNotification(due, memo.content, now)
          await sendNtfyReminder(title, body, `${SITE_URL}/memo`)
          notifiedDues.push(due.iso)
          sent++
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e))
        }
      }

      if (pending.length > 0) {
        await supabaseAdmin
          .from('comments')
          .update({ notified_dues: notifiedDues, notified_at: nowIso })
          .eq('id', memo.id)
      }
    } else if (memo.due_at && !memo.notified_at && new Date(memo.due_at) <= now) {
      // Legacy path: no inline tags, use due_at column directly
      try {
        const { title, body } = buildNotification(
          { label: '', iso: memo.due_at as string },
          memo.content,
          now,
        )
        await sendNtfyReminder(title, body, `${SITE_URL}/memo`)
        await supabaseAdmin
          .from('comments')
          .update({ notified_at: nowIso })
          .eq('id', memo.id)
        sent++
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
  }

  return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined })
}
