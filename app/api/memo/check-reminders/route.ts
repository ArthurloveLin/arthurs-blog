import { NextRequest, NextResponse } from 'next/server'
import { extractMemoHabitChecklistItems, updateMemoHabitChecklistLine } from '@/lib/memo-habits'
import {
  markSupersededMemoHabitOccurrencesAsMissed,
  upsertMemoHabitOccurrenceForReminder,
} from '@/lib/memo-habits-server'
import { getShanghaiWeekday, parseInlineDueTags, stripInlineDueTags } from '@/lib/memo-due-tags'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNtfyReminder } from '@/lib/ntfy'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arthurlovegrace.top'
const REMINDER_TOKEN = process.env.REMINDER_CHECK_TOKEN

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
    ? repeatMode === 'daily' ? ' · 每天'
      : repeatMode === 'weekly' ? ' · 每周'
      : repeatMode === 'monthly' ? ' · 每月'
      : repeatMode === 'weekdays' ? ' · 周一至周五'
      : ' · 自定义重复'
    : ''
  const title = `⏰ ${label}${repeatSuffix}`
  // 去掉 @due 标签后的完整内容；保留换行结构，折叠多余空行，上限 500 字
  const noteText = stripInlineDueTags(content)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 500)
  const timeStr = formatDueTime(due.iso, now)
  // 时间放首行，方便扫视；完整便签内容附后
  const body = noteText ? `截止：${timeStr}\n\n${noteText}` : `截止：${timeStr}`
  return { title, body }
}

// Hard cap on advance iterations (~10 years of daily steps). Guards against a
// non-advancing repeat mode hanging the request, and bounds back-fill catch-up.
const MAX_ADVANCE_ITERATIONS = 3660

// Advance ISO to the *next future* occurrence for the given repeat mode. We keep
// stepping until the result is strictly after `now`, so a back-filled or long-
// overdue task collapses into a single upcoming occurrence instead of replaying
// one notification per missed period on every cron tick. UTC date arithmetic;
// weekday checks are converted to the Asia/Shanghai calendar day.
function advanceDueAt(dueAt: string, repeatMode: string, repeatDays: number[] | null, now: Date): string {
  const due = new Date(dueAt)

  // One step of the given mode. Returns false when the mode cannot advance,
  // signalling the caller to leave dueAt untouched (no resend loop).
  const stepOnce = (): boolean => {
    if (repeatMode === 'daily') {
      due.setUTCDate(due.getUTCDate() + 1)
      return true
    }
    if (repeatMode === 'weekly') {
      due.setUTCDate(due.getUTCDate() + 7)
      return true
    }
    if (repeatMode === 'monthly') {
      // JS rolls overflowing day-of-month into the next month (e.g. Jan 31 → Mar 3).
      due.setUTCMonth(due.getUTCMonth() + 1)
      return true
    }
    if (repeatMode === 'weekdays') {
      do {
        due.setUTCDate(due.getUTCDate() + 1)
      } while ([0, 6].includes(getShanghaiWeekday(due)))
      return true
    }
    if (repeatMode === 'custom' && repeatDays?.length) {
      const sorted = [...repeatDays].sort((a, b) => a - b)
      for (let i = 0; i < 7; i++) {
        due.setUTCDate(due.getUTCDate() + 1)
        if (sorted.includes(getShanghaiWeekday(due))) break
      }
      return true
    }
    return false
  }

  let iterations = 0
  do {
    if (!stepOnce()) return dueAt
    iterations += 1
  } while (due.getTime() <= now.getTime() && iterations < MAX_ADVANCE_ITERATIONS)

  return due.toISOString()
}

export async function POST(req: NextRequest) {
  // Fail closed: a missing token env must never leave this dispatch endpoint open
  // (it sends pushes and mutates rows), so a misconfigured deploy returns 500
  // rather than silently accepting unauthenticated calls.
  if (!REMINDER_TOKEN) {
    return NextResponse.json({ error: 'REMINDER_CHECK_TOKEN not configured' }, { status: 500 })
  }
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (token !== REMINDER_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const nowIso = now.toISOString()

  let sent = 0
  const errors: string[] = []

  // Page size for scanning candidate memos. We page through *all* matches (ordered
  // by id) rather than capping at a fixed count, otherwise reminders on memos past
  // the cap would silently never fire.
  const PAGE_SIZE = 1000

  // ── Primary path: inline @due tags in content ────────────────────────────
  const memos: Array<{ id: string; content: string; notified_dues: unknown; user_id: string; visibility: string }> = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('id, content, notified_dues, user_id, visibility')
      .eq('target_type', 'memo')
      .eq('archived', false)
      .not('user_id', 'is', null)
      .ilike('content', '%@due[%')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) break
    memos.push(...(data as typeof memos))
    if (data.length < PAGE_SIZE) break
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
        const nextIso = advanceDueAt(tag.iso, tag.repeatMode, tag.repeatDays, now)
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
        const nextIso = advanceDueAt(item.dueAt, item.repeatMode, item.repeatDays, now)
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

    // NOTE: do not write `notified_at` here. That column belongs solely to the
    // legacy column-based path below; the inline path tracks delivery via
    // `notified_dues` (once tags) and content rewrite (repeat tags). Writing it
    // here would falsely mark a co-located column due_at as already notified.
    const patch: Record<string, unknown> = {}
    if (pendingOnce.length > 0 || pendingHabitOnce.length > 0) {
      // Prune notified_dues to only ISOs that still exist as once-tags in the
      // final content — drops stale entries from deleted tags automatically.
      const remainingOnceIsos = new Set(
        parseInlineDueTags(updatedContent)
          .filter((t) => t.repeatMode === 'once')
          .map((t) => t.iso),
      )
      patch.notified_dues = notifiedDues.filter((iso) => remainingOnceIsos.has(iso))
    }
    if (pendingRepeat.length > 0 || pendingHabitRepeat.length > 0) patch.content = updatedContent
    if (Object.keys(patch).length > 0) {
      // Surface a failed write: delivery is at-least-once, so a silent failure
      // here means the same notifications resend next tick.
      const { error: updateError } = await supabaseAdmin.from('comments').update(patch).eq('id', memo.id)
      if (updateError) errors.push(`memo ${memo.id} state update failed: ${updateError.message}`)
    }
  }

  // ── Legacy path: column-based due_at / repeat_mode on comments ───────────
  const columnMemos: Array<{ id: string; content: string; due_at: string; notified_at: string | null; repeat_mode: string | null; repeat_days: unknown }> = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('id, content, due_at, notified_at, repeat_mode, repeat_days')
      .eq('target_type', 'memo')
      .eq('archived', false)
      .not('due_at', 'is', null)
      .is('notified_at', null)
      .lte('due_at', nowIso)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) break
    columnMemos.push(...(data as typeof columnMemos))
    if (data.length < PAGE_SIZE) break
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
        const nextDueAt = advanceDueAt(memo.due_at as string, repeatMode, repeatDays, now)
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
