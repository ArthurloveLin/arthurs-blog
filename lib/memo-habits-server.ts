// DB layer for memo habits: Supabase reads/writes, auth checks, and the cron
// upsert path. All state DERIVATION (current state, streaks, day summaries,
// event-time attribution) lives in lib/memo-habits-state.ts — pure, clock-injected
// and unit-tested. Add new derivation logic THERE, not here.

import { getCurrentUser, getUserRole } from '@/lib/auth'
import {
  extractMemoHabitChecklistItems,
  type MemoHabitChecklistItem,
  type MemoHabitItemDetail,
  type MemoHabitOverview,
} from '@/lib/memo-habits'
import {
  buildCurrentState,
  buildCurrentStateIndex,
  buildDaySummaries,
  buildSummary,
  computeTodayDueAt,
  getOccurrenceEventTime,
  getOpenOccurrenceDueAt,
  isHistoryOccurrence,
  toHistoryEvent,
  type CurrentStateSeed,
  type MemoHabitOccurrenceRow,
} from '@/lib/memo-habits-state'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import type { NoteVisibility } from '@/lib/note-boards'
import { toShanghaiDateKey } from '@/lib/shanghai-time'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface MemoHabitNoteRow {
  id: string
  content: string
  visibility: NoteVisibility
  user_id: string
}

const OCCURRENCE_COLUMNS = 'id, note_id, owner_user_id, visibility, item_key, item_label, line_text, due_at, status, reminder_sent_at, completed_at, delayed_to, completion_source, created_at, updated_at'

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
    .select(OCCURRENCE_COLUMNS)
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

  const now = Date.now()
  const currentStates = buildCurrentStateIndex(notes, rows, now)
  const recentEvents = rows
    .filter(isHistoryOccurrence)
    .sort((left, right) => Date.parse(getOccurrenceEventTime(right)) - Date.parse(getOccurrenceEventTime(left)))
    .slice(0, 160)
    .map(toHistoryEvent)

  return {
    summary: buildSummary(currentStates, rows, now),
    currentStates,
    daySummaries: buildDaySummaries(rows, now),
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
    .select(OCCURRENCE_COLUMNS)
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
    .select(OCCURRENCE_COLUMNS)
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
    .select(OCCURRENCE_COLUMNS)
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
