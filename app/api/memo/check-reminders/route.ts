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
  repeatMode?: string | null,
): { title: string; body: string } {
  const label = due.label.trim() || 'Memo 提醒'
  const repeatSuffix = repeatMode && repeatMode !== 'once'
    ? repeatMode === 'daily' ? ' · 每天' : repeatMode === 'weekdays' ? ' · 周一至周五' : ' · 自定义重复'
    : ''
  const title = `⏰ ${label}${repeatSuffix}`
  const snippet = content
    .replace(INLINE_DUE_CAPTURE, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 60)
  const timeStr = formatDueTime(due.iso, now)
  const body = `${snippet ? `${snippet}\n` : ''}截止 ${timeStr}`
  return { title, body }
}

// Advance due_at to the next occurrence based on repeat mode (Shanghai time preserved)
function advanceDueAt(dueAt: string, repeatMode: string, repeatDays: number[] | null): string {
  const due = new Date(dueAt)

  if (repeatMode === 'daily') {
    due.setUTCDate(due.getUTCDate() + 1)
    return due.toISOString()
  }

  if (repeatMode === 'weekdays') {
    due.setUTCDate(due.getUTCDate() + 1)
    // day-of-week in UTC may differ from Shanghai by ±1; use UTC since due_at is stored in UTC
    while (due.getUTCDay() === 0 || due.getUTCDay() === 6) {
      due.setUTCDate(due.getUTCDate() + 1)
    }
    return due.toISOString()
  }

  if (repeatMode === 'custom' && repeatDays?.length) {
    const sorted = [...repeatDays].sort((a, b) => a - b)
    due.setUTCDate(due.getUTCDate() + 1)
    for (let i = 0; i < 7; i++) {
      if (sorted.includes(due.getUTCDay())) break
      due.setUTCDate(due.getUTCDate() + 1)
    }
    return due.toISOString()
  }

  return dueAt
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
    .select('id, author, content, due_at, notified_at, notified_dues, repeat_mode, repeat_days')
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
      // Inline @due tags are always one-time (they embed a specific ISO timestamp)
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
      // Column-based due_at path — supports repeat modes
      const repeatMode: string = (memo.repeat_mode as string | null) ?? 'once'
      const repeatDays: number[] | null = Array.isArray(memo.repeat_days) ? memo.repeat_days as number[] : null

      try {
        const { title, body } = buildNotification(
          { label: '', iso: memo.due_at as string },
          memo.content,
          now,
          repeatMode,
        )
        await sendNtfyReminder(title, body, `${SITE_URL}/memo`)

        if (repeatMode !== 'once') {
          // Advance due_at to the next occurrence; keep notified_at = null so it fires again
          const nextDueAt = advanceDueAt(memo.due_at as string, repeatMode, repeatDays)
          await supabaseAdmin
            .from('comments')
            .update({ due_at: nextDueAt })
            .eq('id', memo.id)
        } else {
          await supabaseAdmin
            .from('comments')
            .update({ notified_at: nowIso })
            .eq('id', memo.id)
        }

        sent++
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
  }

  return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined })
}
