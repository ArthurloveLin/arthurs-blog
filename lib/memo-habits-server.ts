import { getCurrentUser, getUserRole } from '@/lib/auth'
import {
  extractMemoHabitChecklistItems,
  type MemoHabitChecklistItem,
  type MemoHabitCompletionSource,
  type MemoHabitCurrentState,
  type MemoHabitDaySummary,
  type MemoHabitHistoryEvent,
  type MemoHabitItemDetail,
  type MemoHabitOccurrenceStatus,
  type MemoHabitOverview,
} from '@/lib/memo-habits'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import type { NoteVisibility } from '@/lib/note-boards'
import { supabaseAdmin } from '@/lib/supabase-admin'

type StoredMemoHabitOccurrenceStatus = Exclude<MemoHabitOccurrenceStatus, 'scheduled'>

interface MemoHabitOccurrenceRow {
  id: string
  note_id: string
  owner_user_id: string
  visibility: NoteVisibility
  item_key: string
  item_label: string
  line_text: string
  due_at: string
  status: StoredMemoHabitOccurrenceStatus
  reminder_sent_at: string | null
  completed_at: string | null
  delayed_to: string | null
  completion_source: MemoHabitCompletionSource | null
  created_at: string
  updated_at: string
}

type HistoryMemoHabitOccurrenceRow = MemoHabitOccurrenceRow & {
  status: Extract<StoredMemoHabitOccurrenceStatus, 'completed' | 'missed' | 'delayed'>
}

interface MemoHabitNoteRow {
  id: string
  content: string
  visibility: NoteVisibility
  user_id: string
}

interface CurrentStateSeed {
  itemKey: string
  label: string
  lineText: string
  dueAt?: string | null
  repeatMode?: string | null
  repeatDays?: number[] | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const HISTORY_WINDOW_DAYS = 90

function getShanghaiWeekStartMs(): number {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const dow = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekday] ?? 0
  // ISO week: Mon=first day; daysBack = distance back to Monday
  const daysBack = dow === 0 ? 6 : dow - 1
  return new Date(`${year}-${month}-${day}T00:00:00+08:00`).getTime() - daysBack * DAY_MS
}

function getShanghaiDayOfWeek(ts: number): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  }).formatToParts(new Date(ts))
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekday] ?? 0
}

function isScheduledOnDay(repeatMode: string | null | undefined, repeatDays: number[] | null | undefined, dow: number): boolean {
  if (!repeatMode || repeatMode === 'once') return true
  if (repeatMode === 'daily') return true
  if (repeatMode === 'weekdays') return dow >= 1 && dow <= 5
  if (repeatMode === 'custom') return (repeatDays ?? []).includes(dow)
  return true
}

/**
 * For a repeating habit whose original due_at encodes a specific time-of-day
 * in Shanghai timezone, compute the ISO timestamp that represents that same
 * time on *today's* Shanghai date.  This is used as the canonical due_at for
 * the current day's occurrence so that occurrences are per-Shanghai-day rather
 * than pinned to the static ISO value stored in the note content.
 */
function computeTodayDueAt(originalDueAt: string, now: number): string {
  const origParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(originalDueAt))
  const hh = origParts.find((p) => p.type === 'hour')?.value ?? '00'
  const mm = origParts.find((p) => p.type === 'minute')?.value ?? '00'
  const ss = origParts.find((p) => p.type === 'second')?.value ?? '00'

  const todayParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now))
  const year = todayParts.find((p) => p.type === 'year')?.value ?? ''
  const month = todayParts.find((p) => p.type === 'month')?.value ?? ''
  const day = todayParts.find((p) => p.type === 'day')?.value ?? ''

  // Construct the datetime in Shanghai (+08:00) then convert to UTC ISO
  return new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}+08:00`).toISOString()
}

/**
 * Returns the due_at for the next scheduled occurrence at or after `now`.
 * Skips non-scheduled days (weekdays/custom repeat modes) so that a synthetic
 * state never lands on a day the habit isn't meant to run.
 */
function computeNextScheduledDueAt(
  originalDueAt: string,
  repeatMode: string | null | undefined,
  repeatDays: number[] | null | undefined,
  now: number,
): string {
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = now + offset * DAY_MS
    if (isScheduledOnDay(repeatMode, repeatDays, getShanghaiDayOfWeek(candidate))) {
      return computeTodayDueAt(originalDueAt, candidate)
    }
  }
  return computeTodayDueAt(originalDueAt, now)
}

function toShanghaiDateKey(ts: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ts))
  const year = parts.find((part) => part.type === 'year')?.value ?? '0'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  const day = parts.find((part) => part.type === 'day')?.value ?? '00'
  return `${year}-${month}-${day}`
}

function getOccurrenceKey(noteId: string, itemKey: string) {
  return `${noteId}:${itemKey}`
}

function isHistoryOccurrence(row: MemoHabitOccurrenceRow): row is HistoryMemoHabitOccurrenceRow {
  return row.status === 'completed' || row.status === 'missed' || row.status === 'delayed'
}

function getOccurrenceEventTime(row: MemoHabitOccurrenceRow) {
  // Missed/delayed must be attributed to the day the task was DUE, not to
  // updated_at: the reconciler closes stale rows just after midnight, so an
  // updated_at attribution would book yesterday's miss onto the next day (and
  // a Sunday miss onto the next week's stats).
  if (row.status === 'completed') return row.completed_at ?? row.updated_at
  if (row.status === 'missed' || row.status === 'delayed') return row.due_at
  return row.updated_at
}

function getOpenOccurrenceDueAt(row: Pick<MemoHabitOccurrenceRow, 'due_at' | 'delayed_to'>) {
  return row.delayed_to ?? row.due_at
}

function computeCurrentStreak(
  allRows: MemoHabitOccurrenceRow[],
  repeatMode?: string | null,
  repeatDays?: number[] | null,
) {
  // Repair guard for historical double-booked days (a completed row AND a
  // missed/delayed row on the same Shanghai day, produced by the old reminder
  // dedupe that ignored completed rows): a day with any completion counts as
  // done, so drop its missed/delayed siblings before walking the streak.
  const completedDays = new Set(
    allRows.filter((row) => row.status === 'completed').map((row) => toShanghaiDateKey(row.due_at)),
  )
  const rows = allRows.filter(
    (row) => !((row.status === 'missed' || row.status === 'delayed') && completedDays.has(toShanghaiDateKey(row.due_at))),
  )

  if (rows.length === 0) {
    return 0
  }

  // Missed and delayed both break the streak — delay is not a free pass
  if (rows[0]?.status === 'missed' || rows[0]?.status === 'delayed') {
    return 0
  }

  // Skip ALL leading open rows (today's pending + a postponed successor can
  // coexist), not just the first one.
  let startIndex = 0
  while (rows[startIndex]?.status === 'pending') {
    startIndex += 1
  }

  let streak = 0
  let prevCompletedDateKey: string | null = null

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index]
    if (row?.status !== 'completed') {
      break
    }

    const currDateKey = toShanghaiDateKey(row.due_at)

    // If there is a gap between the previous completed day and this one, check
    // whether any scheduled day falls in the gap — if so, the streak is broken.
    if (prevCompletedDateKey !== null) {
      const prevMs = new Date(`${prevCompletedDateKey}T00:00:00+08:00`).getTime()
      const currMs = new Date(`${currDateKey}T00:00:00+08:00`).getTime()
      let gapHasScheduledDay = false
      for (let dayMs = currMs + DAY_MS; dayMs < prevMs; dayMs += DAY_MS) {
        if (isScheduledOnDay(repeatMode, repeatDays, getShanghaiDayOfWeek(dayMs))) {
          gapHasScheduledDay = true
          break
        }
      }
      if (gapHasScheduledDay) {
        break
      }
    }

    streak += 1
    prevCompletedDateKey = currDateKey
  }

  return streak
}

function buildCurrentState(noteId: string, item: CurrentStateSeed, rows: MemoHabitOccurrenceRow[], now: number): MemoHabitCurrentState {
  const streak = computeCurrentStreak(rows, item.repeatMode, item.repeatDays)
  const isRepeating = item.repeatMode && item.repeatMode !== 'once'
  const nowKey = toShanghaiDateKey(new Date(now).toISOString())
  // Only surface an open occurrence if its effective due date is today or in the future.
  // Past-day open rows are stale (pending reconciliation) — skip them so a non-scheduled
  // day doesn't show yesterday's overdue occurrence instead of the correct next-due state.
  // 'delayed' is a terminal status (the postponed-away day's record); only 'pending'
  // rows are open. Rows are due_at-descending, so the LAST match is the earliest open
  // occurrence — acting on the earliest matters when today's row and a postponed
  // successor coexist (otherwise today's actionable pending would be hidden).
  const openRows = rows.filter((row) => {
    if (row.status !== 'pending') return false
    return toShanghaiDateKey(getOpenOccurrenceDueAt(row)) >= nowKey
  })
  const earliestOpen = openRows.length > 0 ? openRows[openRows.length - 1] : null

  if (earliestOpen) {
    const dueAt = getOpenOccurrenceDueAt(earliestOpen)
    return {
      noteId,
      itemKey: item.itemKey,
      label: earliestOpen.item_label,
      lineText: earliestOpen.line_text,
      dueAt,
      status: Date.parse(dueAt) > now ? 'scheduled' : 'pending',
      streak,
      reminderSentAt: earliestOpen.reminder_sent_at,
      completedAt: earliestOpen.completed_at,
      delayedTo: earliestOpen.delayed_to,
      completionSource: earliestOpen.completion_source,
    }
  }

  // Find the latest completion rather than requiring rows[0] to be completed —
  // a same-day missed/delayed sibling row must not hide a real completion.
  const latestCompleted = rows.find((row) => row.status === 'completed') ?? null
  if (latestCompleted) {
    // For repeating habits compare Shanghai dates: if the latest completion is
    // from today (Shanghai), show completed; otherwise it's a new day → pending.
    // For one-off habits retain the legacy exact due_at match.
    const completionKey = toShanghaiDateKey(latestCompleted.due_at)
    const isCurrentPeriod = isRepeating ? completionKey === nowKey : latestCompleted.due_at === item.dueAt

    if (isCurrentPeriod) {
      return {
        noteId,
        itemKey: item.itemKey,
        label: latestCompleted.item_label,
        lineText: latestCompleted.line_text,
        dueAt: latestCompleted.due_at,
        status: 'completed',
        streak,
        reminderSentAt: latestCompleted.reminder_sent_at,
        completedAt: latestCompleted.completed_at,
        delayedTo: latestCompleted.delayed_to,
        completionSource: latestCompleted.completion_source,
      }
    }
  }

  // No current-period completion: compute the next scheduled due_at for repeating
  // habits, skipping days not in the repeat schedule so a synthetic state never
  // appears on a day the habit isn't meant to run.
  // Mark as synthetic so callers can tell there is no real DB occurrence row.
  const dueAt = isRepeating && item.dueAt
    ? computeNextScheduledDueAt(item.dueAt, item.repeatMode, item.repeatDays, now)
    : (item.dueAt ?? rows[0]?.due_at ?? new Date(now).toISOString())
  return {
    noteId,
    itemKey: item.itemKey,
    label: item.label,
    lineText: item.lineText,
    dueAt,
    status: Date.parse(dueAt) <= now ? 'pending' : 'scheduled',
    streak,
    synthetic: true,
  }
}

function toHistoryEvent(row: HistoryMemoHabitOccurrenceRow): MemoHabitHistoryEvent {
  return {
    occurrenceId: row.id,
    noteId: row.note_id,
    itemKey: row.item_key,
    label: row.item_label,
    lineText: row.line_text,
    status: row.status,
    dueAt: row.due_at,
    occurredAt: getOccurrenceEventTime(row),
    delayedTo: row.delayed_to,
    completionSource: row.completion_source,
  }
}

async function fetchVisibleMemoNotes(ownerUserId: string, showAdminOnly: boolean) {
  const config = getNoteBoardConfig('memo')
  let query = supabaseAdmin
    .from('comments')
    .select('id, content, visibility, user_id')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', false)
    .is('parent_id', null)
    .eq('user_id', ownerUserId)

  if (!showAdminOnly) {
    query = query.eq('visibility', 'public')
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as MemoHabitNoteRow[]
}

async function fetchVisibleOccurrences(ownerUserId: string, showAdminOnly: boolean) {
  let query = supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, note_id, owner_user_id, visibility, item_key, item_label, line_text, due_at, status, reminder_sent_at, completed_at, delayed_to, completion_source, created_at, updated_at')
    .eq('owner_user_id', ownerUserId)
    .order('due_at', { ascending: false })
    .limit(2000)

  if (!showAdminOnly) {
    query = query.eq('visibility', 'public')
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as MemoHabitOccurrenceRow[]
}

export async function reconcileStaleMemoHabitOccurrences(ownerUserId: string) {
  // Only 'pending' rows are open; 'delayed' is a terminal record of a
  // postponed-away day (its successor row carries the open state).
  const { data, error } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, due_at, delayed_to, status')
    .eq('owner_user_id', ownerUserId)
    .eq('status', 'pending')
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  // Stale = the occurrence's effective Shanghai calendar day has already passed.
  // Using a midnight boundary (not a 24-hour rolling window) ensures that a habit
  // due at 22:10 is correctly marked missed right after midnight, not 22 hours later.
  const todayKey = toShanghaiDateKey(new Date().toISOString())
  const staleIds = (data ?? [])
    .filter((row) => {
      const dueAt = getOpenOccurrenceDueAt(row as Pick<MemoHabitOccurrenceRow, 'due_at' | 'delayed_to'>)
      return toShanghaiDateKey(dueAt) < todayKey
    })
    .map((row) => row.id as string)

  if (staleIds.length === 0) {
    return
  }

  const { error: updateError } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .update({ status: 'missed', updated_at: new Date().toISOString() })
    .in('id', staleIds)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

function buildStateMap(rows: MemoHabitOccurrenceRow[]) {
  return rows.reduce<Map<string, MemoHabitOccurrenceRow[]>>((map, row) => {
    const key = getOccurrenceKey(row.note_id, row.item_key)
    const bucket = map.get(key) ?? []
    bucket.push(row)
    map.set(key, bucket)
    return map
  }, new Map())
}

function buildCurrentStateIndex(notes: MemoHabitNoteRow[], rows: MemoHabitOccurrenceRow[]) {
  const now = Date.now()
  const rowsByKey = buildStateMap(rows)
  const currentStates: Record<string, Record<string, MemoHabitCurrentState>> = {}

  for (const note of notes) {
    const items = extractMemoHabitChecklistItems(note.content)
    if (items.length === 0) {
      continue
    }

    currentStates[note.id] = items.reduce<Record<string, MemoHabitCurrentState>>((record, item) => {
      const state = buildCurrentState(
        note.id,
        { itemKey: item.itemKey, label: item.label, lineText: item.lineText, dueAt: item.dueAt, repeatMode: item.repeatMode, repeatDays: item.repeatDays },
        rowsByKey.get(getOccurrenceKey(note.id, item.itemKey)) ?? [],
        now,
      )
      record[item.itemKey] = state
      return record
    }, {})
  }

  return currentStates
}

function buildDaySummaries(rows: MemoHabitOccurrenceRow[]): MemoHabitDaySummary[] {
  const cutoff = Date.now() - HISTORY_WINDOW_DAYS * DAY_MS
  const dayMap = new Map<string, MemoHabitDaySummary>()

  for (const row of rows) {
    if (row.status === 'pending') {
      continue
    }

    const occurredAt = Date.parse(getOccurrenceEventTime(row))
    if (occurredAt < cutoff) {
      continue
    }

    const date = toShanghaiDateKey(new Date(occurredAt).toISOString())
    const current = dayMap.get(date) ?? { date, completed: 0, missed: 0, delayed: 0 }
    if (row.status === 'completed') current.completed += 1
    if (row.status === 'missed') current.missed += 1
    if (row.status === 'delayed') current.delayed += 1
    dayMap.set(date, current)
  }

  return [...dayMap.values()].sort((left, right) => left.date.localeCompare(right.date))
}

function buildSummary(currentStates: Record<string, Record<string, MemoHabitCurrentState>>, rows: MemoHabitOccurrenceRow[]) {
  const today = toShanghaiDateKey(new Date().toISOString())
  const weekStartMs = getShanghaiWeekStartMs()
  const recentRows = rows.filter((row) => row.status !== 'pending' && Date.parse(getOccurrenceEventTime(row)) >= weekStartMs)

  const completedToday = rows.filter((row) => row.status === 'completed' && toShanghaiDateKey(getOccurrenceEventTime(row)) === today).length
  const missedThisWeek = recentRows.filter((row) => row.status === 'missed').length
  const delayedThisWeek = recentRows.filter((row) => row.status === 'delayed').length
  const completionRate7d = recentRows.length === 0
    ? 0
    : Math.round((recentRows.filter((row) => row.status === 'completed').length / recentRows.length) * 100)

  const currentStreak = Object.values(currentStates)
    .flatMap((items) => Object.values(items))
    .reduce((max, state) => Math.max(max, state.streak), 0)

  return {
    completedToday,
    currentStreak,
    completionRate7d,
    missedThisWeek,
    delayedThisWeek,
  }
}

export async function getMemoHabitOverview(ownerUserId: string, showAdminOnly = false): Promise<MemoHabitOverview> {
  // Reconcile BEFORE reading (not in after()): the client refetches exactly once
  // at Shanghai midnight, and a post-response reconcile would leave that refetch
  // serving pre-rollover data (yesterday's pendings not yet marked missed).
  // A reconcile failure must not block the read, though.
  try {
    await reconcileStaleMemoHabitOccurrences(ownerUserId)
  } catch (err) {
    console.error('[memo-habits] reconcile failed in getMemoHabitOverview:', err)
  }

  const [notes, rows] = await Promise.all([
    fetchVisibleMemoNotes(ownerUserId, showAdminOnly),
    fetchVisibleOccurrences(ownerUserId, showAdminOnly),
  ])

  const currentStates = buildCurrentStateIndex(notes, rows)
  const recentEvents = rows
    .filter(isHistoryOccurrence)
    .sort((left, right) => Date.parse(getOccurrenceEventTime(right)) - Date.parse(getOccurrenceEventTime(left)))
    .slice(0, 160)
    .map(toHistoryEvent)

  return {
    summary: buildSummary(currentStates, rows),
    currentStates,
    daySummaries: buildDaySummaries(rows),
    recentEvents,
  }
}

function buildItemDetail(noteId: string, item: CurrentStateSeed, rows: MemoHabitOccurrenceRow[]): MemoHabitItemDetail {
  const currentState = buildCurrentState(noteId, item, rows, Date.now())
  return {
    noteId,
    itemKey: item.itemKey,
    label: item.label,
    lineText: item.lineText,
    currentState,
    nextDueAt: item.dueAt ?? null,
    recentOccurrences: rows
      .filter(isHistoryOccurrence)
      .sort((left, right) => Date.parse(getOccurrenceEventTime(right)) - Date.parse(getOccurrenceEventTime(left)))
      .slice(0, 20)
      .map(toHistoryEvent),
  }
}

export async function getMemoHabitItemDetail(noteId: string, itemKey: string, ownerUserId: string, showAdminOnly = false): Promise<MemoHabitItemDetail> {
  // Same as getMemoHabitOverview: reconcile before reading so the detail panel
  // never renders pre-rollover state; failures degrade to a stale-but-served read.
  try {
    await reconcileStaleMemoHabitOccurrences(ownerUserId)
  } catch (err) {
    console.error('[memo-habits] reconcile failed in getMemoHabitItemDetail:', err)
  }

  const config = getNoteBoardConfig('memo')
  const { data: note, error } = await supabaseAdmin
    .from('comments')
    .select('id, content, visibility, user_id')
    .eq('id', noteId)
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .single()

  if (error || !note || note.user_id !== ownerUserId || (!showAdminOnly && note.visibility !== 'public')) {
    throw new Error('NOT_FOUND')
  }

  const parsedItem = extractMemoHabitChecklistItems(note.content as string).find((item) => item.itemKey === itemKey)
  const { data: rows, error: rowsError } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, note_id, owner_user_id, visibility, item_key, item_label, line_text, due_at, status, reminder_sent_at, completed_at, delayed_to, completion_source, created_at, updated_at')
    .eq('note_id', noteId)
    .eq('item_key', itemKey)
    .order('due_at', { ascending: false })
    .limit(60)

  if (rowsError) {
    throw new Error(rowsError.message)
  }

  const typedRows = (rows ?? []) as MemoHabitOccurrenceRow[]
  const seed: CurrentStateSeed = parsedItem
    ? { itemKey: parsedItem.itemKey, label: parsedItem.label, lineText: parsedItem.lineText, dueAt: parsedItem.dueAt, repeatMode: parsedItem.repeatMode, repeatDays: parsedItem.repeatDays }
    : {
        itemKey,
        label: typedRows[0]?.item_label ?? '重复任务',
        lineText: typedRows[0]?.line_text ?? '',
        dueAt: typedRows[0]?.due_at ?? null,
      }

  return buildItemDetail(noteId, seed, typedRows)
}

async function getAuthorizedMemoNote(noteId: string) {
  const [role, currentUser] = await Promise.all([getUserRole(), getCurrentUser()])
  const config = getNoteBoardConfig('memo')

  const { data: note, error } = await supabaseAdmin
    .from('comments')
    .select('id, content, visibility, user_id')
    .eq('id', noteId)
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .single()

  if (error || !note) {
    throw new Error('NOT_FOUND')
  }

  const isOwner = currentUser?.id != null && currentUser.id === note.user_id
  if (role !== 'admin' && !isOwner) {
    throw new Error('FORBIDDEN')
  }

  return note as MemoHabitNoteRow
}

async function fetchLatestOccurrences(noteId: string, itemKey: string) {
  const { data, error } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, note_id, owner_user_id, visibility, item_key, item_label, line_text, due_at, status, reminder_sent_at, completed_at, delayed_to, completion_source, created_at, updated_at')
    .eq('note_id', noteId)
    .eq('item_key', itemKey)
    .order('due_at', { ascending: false })
    .limit(10)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as MemoHabitOccurrenceRow[]
}

async function resolveOrCreateOccurrence(note: MemoHabitNoteRow, item: MemoHabitChecklistItem, nowIso: string) {
  const now = Date.parse(nowIso)
  const isRepeating = item.repeatMode !== 'once'
  // For repeating habits use today's Shanghai-day occurrence timestamp so that
  // each calendar day gets its own row independently of the static ISO value
  // stored in the note content.
  const effectiveDueAt = isRepeating && item.dueAt
    ? computeTodayDueAt(item.dueAt, now)
    : item.dueAt

  const rows = await fetchLatestOccurrences(note.id, item.itemKey)
  // Mirror buildCurrentState: only 'pending' rows are open, skip past-day rows, and
  // act on the EARLIEST open occurrence (rows are due_at-descending, so last match).
  // Taking the latest would complete a postponed successor while today's pending
  // silently runs into midnight reconciliation.
  const nowKey = toShanghaiDateKey(nowIso)
  const openRows = rows.filter((row) => {
    if (row.status !== 'pending') return false
    return toShanghaiDateKey(getOpenOccurrenceDueAt(row)) >= nowKey
  })
  const earliestOpen = openRows.length > 0 ? openRows[openRows.length - 1] : null
  if (earliestOpen) {
    return earliestOpen
  }

  if (isRepeating) {
    // For repeating habits, look for an existing occurrence on today's Shanghai date
    const todayKey = toShanghaiDateKey(nowIso)
    const todayRow = rows.find((row) => toShanghaiDateKey(row.due_at) === todayKey)
    if (todayRow) {
      return todayRow
    }
  } else if (rows[0]?.due_at === item.dueAt) {
    return rows[0]
  }

  const { data, error } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .upsert({
      note_id: note.id,
      owner_user_id: note.user_id,
      visibility: note.visibility,
      item_key: item.itemKey,
      item_label: item.label,
      line_text: item.lineText,
      due_at: effectiveDueAt,
      status: 'pending',
      updated_at: nowIso,
    }, { onConflict: 'note_id,item_key,due_at' })
    .select('id, note_id, owner_user_id, visibility, item_key, item_label, line_text, due_at, status, reminder_sent_at, completed_at, delayed_to, completion_source, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'UPSERT_FAILED')
  }

  return data as MemoHabitOccurrenceRow
}

export async function completeMemoHabitOccurrence(noteId: string, itemKey: string) {
  const note = await getAuthorizedMemoNote(noteId)
  const item = extractMemoHabitChecklistItems(note.content).find((entry) => entry.itemKey === itemKey)
  if (!item) {
    throw new Error('NOT_FOUND')
  }

  const nowIso = new Date().toISOString()
  const occurrence = await resolveOrCreateOccurrence(note, item, nowIso)

  if (occurrence.status !== 'completed') {
    const { error } = await supabaseAdmin
      .from('memo_habit_occurrences')
      .update({
        status: 'completed',
        completed_at: nowIso,
        completion_source: 'manual_check',
        updated_at: nowIso,
      })
      .eq('id', occurrence.id)

    if (error) {
      throw new Error(error.message)
    }
  }

  return getMemoHabitItemDetail(note.id, itemKey, note.user_id, true)
}

export async function delayMemoHabitOccurrence(noteId: string, itemKey: string, delayUntil: string) {
  const note = await getAuthorizedMemoNote(noteId)
  const item = extractMemoHabitChecklistItems(note.content).find((entry) => entry.itemKey === itemKey)
  if (!item) {
    throw new Error('NOT_FOUND')
  }

  if (Number.isNaN(Date.parse(delayUntil))) {
    throw new Error('INVALID_DELAY')
  }

  const nowIso = new Date().toISOString()
  const occurrence = await resolveOrCreateOccurrence(note, item, nowIso)

  if (occurrence.status === 'completed') {
    return getMemoHabitItemDetail(note.id, itemKey, note.user_id, true)
  }

  const currentDueAt = getOpenOccurrenceDueAt(occurrence)
  const isCrossDayDelay = toShanghaiDateKey(currentDueAt) !== toShanghaiDateKey(delayUntil)

  if (!isCrossDayDelay) {
    const { error } = await supabaseAdmin
      .from('memo_habit_occurrences')
      .update({
        due_at: delayUntil,
        status: 'pending',
        delayed_to: null,
        reminder_sent_at: null,
        updated_at: nowIso,
      })
      .eq('id', occurrence.id)

    if (error) {
      throw new Error(error.message)
    }

    return getMemoHabitItemDetail(note.id, itemKey, note.user_id, true)
  }

  // Cross-day postpones close today's occurrence as DELAYED (terminal, keeps the
  // "this day was postponed" trace for stats/history — NOT missed) and open a new
  // pending row on the target date. INSERT before PATCH so that a PATCH failure
  // leaves two open rows (self-healing via reconcile) rather than a lost task.
  const delayDateKey = toShanghaiDateKey(delayUntil)
  // Skip the insert when the target day already has an open or completed row —
  // inserting next to a completed one would double-book that day.
  const { data: targetDateRows, error: targetDateError } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, due_at, status')
    .eq('note_id', note.id)
    .eq('item_key', item.itemKey)
    .in('status', ['pending', 'completed'])
    .limit(30)

  if (targetDateError) {
    throw new Error(targetDateError.message)
  }

  const alreadyScheduledOnTargetDate = (targetDateRows ?? []).some(
    (row: { due_at: string }) => toShanghaiDateKey(row.due_at) === delayDateKey,
  )

  if (!alreadyScheduledOnTargetDate) {
    const { error: insertNextError } = await supabaseAdmin
      .from('memo_habit_occurrences')
      .insert({
        note_id: note.id,
        owner_user_id: note.user_id,
        visibility: note.visibility,
        item_key: item.itemKey,
        item_label: item.label,
        line_text: item.lineText,
        due_at: delayUntil,
        status: 'pending',
        reminder_sent_at: null,
        updated_at: nowIso,
      })

    if (insertNextError) {
      throw new Error(insertNextError.message)
    }
  }

  // Mark the current occurrence delayed only after the successor row is safely written.
  const { error: markDelayedError } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .update({
      status: 'delayed',
      delayed_to: delayUntil,
      updated_at: nowIso,
    })
    .eq('id', occurrence.id)

  if (markDelayedError) {
    throw new Error(markDelayedError.message)
  }

  return getMemoHabitItemDetail(note.id, itemKey, note.user_id, true)
}

export async function markSupersededMemoHabitOccurrencesAsMissed(noteId: string, itemKey: string, dueAt: string) {
  const { data, error } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, due_at, status')
    .eq('note_id', noteId)
    .eq('item_key', itemKey)
    .eq('status', 'pending')
    .lt('due_at', dueAt)

  if (error) {
    throw new Error(error.message)
  }

  // Only close rows from PREVIOUS Shanghai days. A same-day pending at an earlier
  // time (user moved today's task earlier) is still today's live occurrence — the
  // reminder upsert dedupes against it; flipping it to missed here would
  // double-book the day (one missed + one fresh pending).
  const dueDayKey = toShanghaiDateKey(dueAt)
  const staleIds = (data ?? [])
    .filter((row) => toShanghaiDateKey(row.due_at as string) < dueDayKey)
    .map((row) => row.id as string)
  if (staleIds.length === 0) {
    return
  }

  const nowIso = new Date().toISOString()
  const { error: updateError } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .update({ status: 'missed', updated_at: nowIso })
    .in('id', staleIds)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export interface MemoHabitReminderUpsertResult {
  /** False when the day is already handled (completed early / postponed away) — the caller must not send the notification. */
  shouldNotify: boolean
  /** When an open same-day row exists at a different time, its due_at (so the notification can show the real time). */
  effectiveDueAt?: string
}

export async function upsertMemoHabitOccurrenceForReminder(note: MemoHabitNoteRow, item: MemoHabitChecklistItem, reminderSentAt: string): Promise<MemoHabitReminderUpsertResult> {
  // For repeating habits, look at ALL of today's (Shanghai) rows before creating one:
  //   completed → the habit was done earlier today; no new row AND no reminder.
  //   delayed   → today was postponed to another day; no new row AND no reminder.
  //   pending   → a same-day postpone moved the time; reuse that row, still remind
  //               (with its actual due time) since it is due today.
  // The old check only looked at OPEN rows, so a habit completed early (e.g. via a
  // postponed-to-morning occurrence) got a second pending row at the planned time,
  // which then went missed at midnight and killed the streak.
  if (item.repeatMode !== 'once') {
    const dayKey = toShanghaiDateKey(item.dueAt)
    const { data: dayRows } = await supabaseAdmin
      .from('memo_habit_occurrences')
      .select('id, due_at, status')
      .eq('note_id', note.id)
      .eq('item_key', item.itemKey)
      .in('status', ['pending', 'delayed', 'completed'])
      .order('due_at', { ascending: false })
      .limit(30)

    const sameDayRows = (dayRows ?? []).filter(
      (row: { due_at: string }) => toShanghaiDateKey(row.due_at) === dayKey,
    )
    if (sameDayRows.some((row: { status: string }) => row.status === 'completed' || row.status === 'delayed')) {
      return { shouldNotify: false }
    }
    const sameDayPending = sameDayRows.find((row: { status: string }) => row.status === 'pending')
    if (sameDayPending) {
      return { shouldNotify: true, effectiveDueAt: (sameDayPending as { due_at: string }).due_at }
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, status')
    .eq('note_id', note.id)
    .eq('item_key', item.itemKey)
    .eq('due_at', item.dueAt)
    .maybeSingle()

  if (existing?.status === 'completed') {
    return { shouldNotify: false }
  }

  const { data, error } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .upsert({
      note_id: note.id,
      owner_user_id: note.user_id,
      visibility: note.visibility,
      item_key: item.itemKey,
      item_label: item.label,
      line_text: item.lineText,
      due_at: item.dueAt,
      status: 'pending',
      reminder_sent_at: reminderSentAt,
      updated_at: reminderSentAt,
    }, { onConflict: 'note_id,item_key,due_at' })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'UPSERT_FAILED')
  }

  return { shouldNotify: true }
}

export async function deleteMemoHabitOccurrence(occurrenceId: string) {
  const [role, currentUser] = await Promise.all([getUserRole(), getCurrentUser()])

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .select('id, note_id, owner_user_id')
    .eq('id', occurrenceId)
    .single()

  if (fetchError || !row) {
    throw new Error('NOT_FOUND')
  }

  const isOwner = currentUser?.id != null && currentUser.id === (row as { owner_user_id?: string | null }).owner_user_id
  if (role !== 'admin' && !isOwner) {
    throw new Error('FORBIDDEN')
  }

  const { error } = await supabaseAdmin
    .from('memo_habit_occurrences')
    .delete()
    .eq('id', occurrenceId)

  if (error) {
    throw new Error(error.message)
  }
}