// Pure memo-habit state machine: derives current state, streaks, history events
// and stats from occurrence rows. NO database access and NO ambient clock — every
// time-dependent function takes `now` (ms) so behaviour is unit-testable
// (tests/unit/memo-habits-state.test.ts covers the historical bug scenarios).
// DB reads/writes live in lib/memo-habits-server.ts, which composes these.

import {
  extractMemoHabitChecklistItems,
  type MemoHabitCompletionSource,
  type MemoHabitCurrentState,
  type MemoHabitDaySummary,
  type MemoHabitHistoryEvent,
  type MemoHabitOccurrenceStatus,
  type MemoHabitOverviewSummary,
} from '@/lib/memo-habits'
import type { NoteVisibility } from '@/lib/note-boards'
import { getShanghaiWeekday, toShanghaiDateKey } from '@/lib/shanghai-time'

export type StoredMemoHabitOccurrenceStatus = Exclude<MemoHabitOccurrenceStatus, 'scheduled'>

export interface MemoHabitOccurrenceRow {
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

export type HistoryMemoHabitOccurrenceRow = MemoHabitOccurrenceRow & {
  status: Extract<StoredMemoHabitOccurrenceStatus, 'completed' | 'missed' | 'delayed'>
}

export interface CurrentStateSeed {
  itemKey: string
  label: string
  lineText: string
  dueAt?: string | null
  repeatMode?: string | null
  repeatDays?: number[] | null
}

export const DAY_MS = 24 * 60 * 60 * 1000
export const HISTORY_WINDOW_DAYS = 90

export function getShanghaiWeekStartMs(now: number): number {
  const dayKey = toShanghaiDateKey(new Date(now))
  const dow = getShanghaiWeekday(new Date(now))
  // ISO week: Mon=first day; daysBack = distance back to Monday
  const daysBack = dow === 0 ? 6 : dow - 1
  return new Date(`${dayKey}T00:00:00+08:00`).getTime() - daysBack * DAY_MS
}

export function isScheduledOnDay(repeatMode: string | null | undefined, repeatDays: number[] | null | undefined, dow: number): boolean {
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
export function computeTodayDueAt(originalDueAt: string, now: number): string {
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

  const dayKey = toShanghaiDateKey(new Date(now))

  // Construct the datetime in Shanghai (+08:00) then convert to UTC ISO
  return new Date(`${dayKey}T${hh}:${mm}:${ss}+08:00`).toISOString()
}

/**
 * Returns the due_at for the next scheduled occurrence at or after `now`.
 * Skips non-scheduled days (weekdays/custom repeat modes) so that a synthetic
 * state never lands on a day the habit isn't meant to run.
 *
 * NOT the same as advanceDueAt (lib/memo-due-tags.ts): that one steps a content
 * tag's ISO forward period-by-period for the reminder dispatcher; this one
 * anchors to today's Shanghai date for synthetic current states.
 */
export function computeNextScheduledDueAt(
  originalDueAt: string,
  repeatMode: string | null | undefined,
  repeatDays: number[] | null | undefined,
  now: number,
): string {
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = now + offset * DAY_MS
    if (isScheduledOnDay(repeatMode, repeatDays, getShanghaiWeekday(new Date(candidate)))) {
      return computeTodayDueAt(originalDueAt, candidate)
    }
  }
  return computeTodayDueAt(originalDueAt, now)
}

export function getOccurrenceKey(noteId: string, itemKey: string) {
  return `${noteId}:${itemKey}`
}

export function isHistoryOccurrence(row: MemoHabitOccurrenceRow): row is HistoryMemoHabitOccurrenceRow {
  return row.status === 'completed' || row.status === 'missed' || row.status === 'delayed'
}

export function getOccurrenceEventTime(row: MemoHabitOccurrenceRow) {
  // Missed/delayed must be attributed to the day the task was DUE, not to
  // updated_at: the reconciler closes stale rows just after midnight, so an
  // updated_at attribution would book yesterday's miss onto the next day (and
  // a Sunday miss onto the next week's stats).
  if (row.status === 'completed') return row.completed_at ?? row.updated_at
  if (row.status === 'missed' || row.status === 'delayed') return row.due_at
  return row.updated_at
}

export function getOpenOccurrenceDueAt(row: Pick<MemoHabitOccurrenceRow, 'due_at' | 'delayed_to'>) {
  return row.delayed_to ?? row.due_at
}

export function computeCurrentStreak(
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
        if (isScheduledOnDay(repeatMode, repeatDays, getShanghaiWeekday(new Date(dayMs)))) {
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

export function buildCurrentState(noteId: string, item: CurrentStateSeed, rows: MemoHabitOccurrenceRow[], now: number): MemoHabitCurrentState {
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

export function toHistoryEvent(row: HistoryMemoHabitOccurrenceRow): MemoHabitHistoryEvent {
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

export function buildStateMap(rows: MemoHabitOccurrenceRow[]) {
  return rows.reduce<Map<string, MemoHabitOccurrenceRow[]>>((map, row) => {
    const key = getOccurrenceKey(row.note_id, row.item_key)
    const bucket = map.get(key) ?? []
    bucket.push(row)
    map.set(key, bucket)
    return map
  }, new Map())
}

export function buildCurrentStateIndex(
  notes: Array<{ id: string; content: string }>,
  rows: MemoHabitOccurrenceRow[],
  now: number,
) {
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

export function buildDaySummaries(rows: MemoHabitOccurrenceRow[], now: number): MemoHabitDaySummary[] {
  const cutoff = now - HISTORY_WINDOW_DAYS * DAY_MS
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

export function buildSummary(
  currentStates: Record<string, Record<string, MemoHabitCurrentState>>,
  rows: MemoHabitOccurrenceRow[],
  now: number,
): MemoHabitOverviewSummary {
  const today = toShanghaiDateKey(new Date(now).toISOString())
  const weekStartMs = getShanghaiWeekStartMs(now)
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
