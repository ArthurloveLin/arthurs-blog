import { NextRequest, NextResponse } from 'next/server'
import { extractMemoHabitChecklistItems, updateMemoHabitChecklistLine } from '@/lib/memo-habits'
import {
  markSupersededMemoHabitOccurrencesAsMissed,
  upsertMemoHabitOccurrenceForReminder,
} from '@/lib/memo-habits-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNtfyReminder } from '@/lib/ntfy'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arthurlovegrace.top'
const REMINDER_TOKEN = process.env.REMINDER_CHECK_TOKEN

const INLINE_DUE_CAPTURE = /@due\[([^\]]*)\]\(([^)]*)\)/g

// Tag format: @due[label](iso) or @due[label](iso,daily|weekdays|custom:0,1,2)
function parseDueParens(raw: string): { iso: string; repeatSpec: string } {
  const comma = raw.indexOf(',')
  if (comma === -1) return { iso: raw, repeatSpec: '' }
  return { iso: raw.slice(0, comma), repeatSpec: raw.slice(comma + 1) }
}

function parseRepeatSpec(spec: string): { repeatMode: string; repeatDays: number[] | null } {
  if (!spec) return { repeatMode: 'once', repeatDays: null }
  if (spec === 'daily') return { repeatMode: 'daily', repeatDays: null }
  if (spec === 'weekdays') return { repeatMode: 'weekdays', repeatDays: null }
  if (spec.startsWith('custom:')) {
    const days = spec.slice(7).split(',').map(Number).filter((d) => !isNaN(d) && d >= 0 && d <= 6)
    return { repeatMode: 'custom', repeatDays: days.length > 0 ? days : null }
  }
  return { repeatMode: 'once', repeatDays: null }
}

function parseInlineDueTags(content: string): Array<{ label: string; iso: string; repeatMode: string; repeatDays: number[] | null; fullMatch: string; rawParens: string }> {
  const result: Array<{ label: string; iso: string; repeatMode: string; repeatDays: number[] | null; fullMatch: string; rawParens: string }> = []
  INLINE_DUE_CAPTURE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_DUE_CAPTURE.exec(content)) !== null) {
    const { iso, repeatSpec } = parseDueParens(match[2])
    if (!iso || isNaN(Date.parse(iso))) continue
    const { repeatMode, repeatDays } = parseRepeatSpec(repeatSpec)
    result.push({ label: match[1], iso, repeatMode, repeatDays, fullMatch: match[0], rawParens: match[2] })
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
  // 去掉 @due 标签后的完整内容；保留换行结构，折叠多余空行，上限 500 字
  const noteText = content
    .replace(INLINE_DUE_CAPTURE, (_match, label: string) => label.trim())
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 500)
  const timeStr = formatDueTime(due.iso, now)
  // 时间放首行，方便扫视；完整便签内容附后
  const body = noteText ? `截止：${timeStr}\n\n${noteText}` : `截止：${timeStr}`
  return { title, body }
}

// Advance ISO to the next occurrence based on repeat mode (UTC preserved)
function advanceDueAt(dueAt: string, repeatMode: string, repeatDays: number[] | null): string {
  const due = new Date(dueAt)

  if (repeatMode === 'daily') {
    due.setUTCDate(due.getUTCDate() + 1)
    return due.toISOString()
  }

  if (repeatMode === 'weekdays') {
    due.setUTCDate(due.getUTCDate() + 1)
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

  let sent = 0
  const errors: string[] = []

  // ── Primary path: inline @due tags in content ────────────────────────────
  const { data: memos, error: memosError } = await supabaseAdmin
    .from('comments')
    .select('id, content, notified_dues, user_id, visibility')
    .eq('target_type', 'memo')
    .eq('archived', false)
    .not('user_id', 'is', null)
    .ilike('content', '%@due[%')
    .limit(100)

  if (memosError) {
    return NextResponse.json({ error: memosError.message }, { status: 500 })
  }

  for (const memo of memos ?? []) {
    const habitItems = extractMemoHabitChecklistItems(memo.content)
    const habitTagSignatures = new Set(habitItems.map((item) => `${item.label}|${item.dueAt}`))
    const tags = parseInlineDueTags(memo.content).filter((tag) => !habitTagSignatures.has(`${tag.label.trim() || '截止'}|${tag.iso}`))
    const notifiedDues: string[] = Array.isArray(memo.notified_dues) ? memo.notified_dues : []

    const pendingOnce: typeof tags = []
    const pendingRepeat: typeof tags = []

    for (const tag of tags) {
      if (new Date(tag.iso) > now) continue
      if (tag.repeatMode === 'once') {
        if (!notifiedDues.includes(tag.iso)) pendingOnce.push(tag)
      } else {
        pendingRepeat.push(tag)
      }
    }

    const pendingHabitOnce = habitItems.filter((item) => item.repeatMode === 'once' && new Date(item.dueAt) <= now && !notifiedDues.includes(item.dueAt))
    const pendingHabitRepeat = habitItems.filter((item) => item.repeatMode !== 'once' && new Date(item.dueAt) <= now)

    if (pendingOnce.length === 0 && pendingRepeat.length === 0 && pendingHabitOnce.length === 0 && pendingHabitRepeat.length === 0) continue

    let updatedContent = memo.content

    for (const tag of pendingOnce) {
      try {
        const { title, body } = buildNotification(tag, memo.content, now)
        await sendNtfyReminder(title, body, `${SITE_URL}/memo`)
        notifiedDues.push(tag.iso)
        sent++
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }

    for (const tag of pendingRepeat) {
      try {
        const { title, body } = buildNotification(tag, memo.content, now, tag.repeatMode)
        await sendNtfyReminder(title, body, `${SITE_URL}/memo`)
        const nextIso = advanceDueAt(tag.iso, tag.repeatMode, tag.repeatDays)
        const newRawParens = nextIso + (tag.rawParens.includes(',') ? tag.rawParens.slice(tag.rawParens.indexOf(',')) : '')
        const newTag = `@due[${tag.label}](${newRawParens})`
        updatedContent = updatedContent.split(tag.fullMatch).join(newTag)
        sent++
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }

    for (const item of pendingHabitOnce) {
      try {
        await upsertMemoHabitOccurrenceForReminder({
          id: memo.id as string,
          content: memo.content as string,
          visibility: memo.visibility as 'public' | 'admin_only',
          user_id: memo.user_id as string,
        }, item, nowIso)
        const { title, body } = buildNotification({ label: item.label, iso: item.dueAt }, memo.content, now)
        await sendNtfyReminder(title, body, `${SITE_URL}/memo`)
        notifiedDues.push(item.dueAt)
        sent++
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }

    for (const item of pendingHabitRepeat) {
      try {
        await markSupersededMemoHabitOccurrencesAsMissed(memo.id as string, item.itemKey, item.dueAt)
        await upsertMemoHabitOccurrenceForReminder({
          id: memo.id as string,
          content: memo.content as string,
          visibility: memo.visibility as 'public' | 'admin_only',
          user_id: memo.user_id as string,
        }, item, nowIso)
        // Advance content before sending notification so that a ntfy failure
        // does not leave due_at un-advanced, causing an infinite retry loop.
        const nextIso = advanceDueAt(item.dueAt, item.repeatMode, item.repeatDays)
        updatedContent = updateMemoHabitChecklistLine(updatedContent, item.lineIndex, {
          checked: false,
          dueAt: nextIso,
        })
        const { title, body } = buildNotification({ label: item.label, iso: item.dueAt }, memo.content, now, item.repeatMode)
        await sendNtfyReminder(title, body, `${SITE_URL}/memo`)
        sent++
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }

    const patch: Record<string, unknown> = { notified_at: nowIso }
    if (pendingOnce.length > 0 || pendingHabitOnce.length > 0) patch.notified_dues = notifiedDues
    if (pendingRepeat.length > 0 || pendingHabitRepeat.length > 0) patch.content = updatedContent
    await supabaseAdmin.from('comments').update(patch).eq('id', memo.id)
  }

  // ── Legacy path: column-based due_at / repeat_mode on comments ───────────
  const { data: columnMemos, error: columnError } = await supabaseAdmin
    .from('comments')
    .select('id, content, due_at, notified_at, repeat_mode, repeat_days')
    .eq('target_type', 'memo')
    .eq('archived', false)
    .not('due_at', 'is', null)
    .is('notified_at', null)
    .lte('due_at', nowIso)
    .limit(100)

  if (columnError) {
    return NextResponse.json({ error: columnError.message }, { status: 500 })
  }

  for (const memo of columnMemos ?? []) {
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
        const nextDueAt = advanceDueAt(memo.due_at as string, repeatMode, repeatDays)
        await supabaseAdmin.from('comments').update({ due_at: nextDueAt }).eq('id', memo.id)
      } else {
        await supabaseAdmin.from('comments').update({ notified_at: nowIso }).eq('id', memo.id)
      }
      sent++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined })
}
