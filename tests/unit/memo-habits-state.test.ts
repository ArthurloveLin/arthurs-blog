import { describe, it, expect } from 'vitest'

import {
  buildCurrentState,
  buildDaySummaries,
  buildSummary,
  computeCurrentStreak,
  computeNextScheduledDueAt,
  computeTodayDueAt,
  getOccurrenceEventTime,
  getShanghaiWeekStartMs,
  type MemoHabitOccurrenceRow,
} from '@/lib/memo-habits-state'
import { advanceDueAt } from '@/lib/memo-due-tags'

// ── helpers ────────────────────────────────────────────────────────────────

// 2026-06-10 is a Wednesday. 22:00 Shanghai = 14:00 UTC.
const shanghai = (date: string, time = '22:00:00') => new Date(`${date}T${time}+08:00`).toISOString()

let rowSeq = 0
function row(partial: Partial<MemoHabitOccurrenceRow> & Pick<MemoHabitOccurrenceRow, 'due_at' | 'status'>): MemoHabitOccurrenceRow {
  rowSeq += 1
  return {
    id: `occ_${rowSeq}`,
    note_id: 'note_1',
    owner_user_id: 'user_1',
    visibility: 'public',
    item_key: 'habit_x',
    item_label: '锻炼',
    line_text: '晨间锻炼',
    reminder_sent_at: null,
    completed_at: partial.status === 'completed' ? partial.due_at : null,
    delayed_to: null,
    completion_source: null,
    created_at: partial.due_at,
    updated_at: partial.due_at,
    ...partial,
  }
}

const dailySeed = { itemKey: 'habit_x', label: '锻炼', lineText: '晨间锻炼', dueAt: shanghai('2026-06-01'), repeatMode: 'daily', repeatDays: null }

// rows must be due_at-DESCENDING, matching the DB query order the code assumes
const desc = (rows: MemoHabitOccurrenceRow[]) => [...rows].sort((a, b) => Date.parse(b.due_at) - Date.parse(a.due_at))

// ── event-time attribution (the "midnight books the miss onto tomorrow" bug) ──

describe('getOccurrenceEventTime', () => {
  it('attributes missed/delayed to due_at even when updated_at is after midnight', () => {
    const missed = row({
      due_at: shanghai('2026-06-09', '22:10:00'),
      status: 'missed',
      // reconciler closed it just after midnight on the 10th
      updated_at: shanghai('2026-06-10', '00:00:40'),
    })
    expect(getOccurrenceEventTime(missed)).toBe(shanghai('2026-06-09', '22:10:00'))
  })

  it('attributes completed to completed_at', () => {
    const completed = row({
      due_at: shanghai('2026-06-09'),
      status: 'completed',
      completed_at: shanghai('2026-06-09', '23:30:00'),
      updated_at: shanghai('2026-06-10', '08:00:00'),
    })
    expect(getOccurrenceEventTime(completed)).toBe(shanghai('2026-06-09', '23:30:00'))
  })
})

describe('buildDaySummaries', () => {
  it('books a reconciled miss onto its due day, not the reconcile day', () => {
    const now = Date.parse(shanghai('2026-06-10', '00:05:00'))
    const rows = [row({
      due_at: shanghai('2026-06-09', '22:10:00'),
      status: 'missed',
      updated_at: shanghai('2026-06-10', '00:00:40'),
    })]
    const summaries = buildDaySummaries(rows, now)
    expect(summaries).toEqual([{ date: '2026-06-09', completed: 0, missed: 1, delayed: 0 }])
  })
})

describe('buildSummary', () => {
  it('counts a Sunday-night miss reconciled on Monday into the PREVIOUS week', () => {
    // 2026-06-07 is a Sunday; 2026-06-08 (Mon) 00:01 reconcile.
    const now = Date.parse(shanghai('2026-06-08', '09:00:00'))
    const rows = [row({
      due_at: shanghai('2026-06-07', '22:00:00'),
      status: 'missed',
      updated_at: shanghai('2026-06-08', '00:01:00'),
    })]
    const summary = buildSummary({}, rows, now)
    expect(summary.missedThisWeek).toBe(0)
  })

  it('week starts on Shanghai Monday', () => {
    // Wed 2026-06-10 → week start Mon 2026-06-08 00:00 +08:00
    const now = Date.parse(shanghai('2026-06-10', '12:00:00'))
    expect(getShanghaiWeekStartMs(now)).toBe(new Date('2026-06-08T00:00:00+08:00').getTime())
  })
})

// ── streak ─────────────────────────────────────────────────────────────────

describe('computeCurrentStreak', () => {
  it('counts consecutive completed days, newest first', () => {
    const rows = desc([
      row({ due_at: shanghai('2026-06-10'), status: 'completed' }),
      row({ due_at: shanghai('2026-06-09'), status: 'completed' }),
      row({ due_at: shanghai('2026-06-08'), status: 'completed' }),
    ])
    expect(computeCurrentStreak(rows, 'daily', null)).toBe(3)
  })

  it('missed and delayed both break the streak', () => {
    for (const status of ['missed', 'delayed'] as const) {
      const rows = desc([
        row({ due_at: shanghai('2026-06-10'), status }),
        row({ due_at: shanghai('2026-06-09'), status: 'completed' }),
      ])
      expect(computeCurrentStreak(rows, 'daily', null)).toBe(0)
    }
  })

  it('skips ALL leading pending rows (today + postponed successor)', () => {
    const rows = desc([
      row({ due_at: shanghai('2026-06-11'), status: 'pending' }),
      row({ due_at: shanghai('2026-06-10'), status: 'pending' }),
      row({ due_at: shanghai('2026-06-09'), status: 'completed' }),
      row({ due_at: shanghai('2026-06-08'), status: 'completed' }),
    ])
    expect(computeCurrentStreak(rows, 'daily', null)).toBe(2)
  })

  it('a weekend gap does not break a weekdays streak, a weekday gap does', () => {
    // 2026-06-05 Fri, 06-08 Mon: weekend gap OK for weekdays mode
    const overWeekend = desc([
      row({ due_at: shanghai('2026-06-08'), status: 'completed' }),
      row({ due_at: shanghai('2026-06-05'), status: 'completed' }),
    ])
    expect(computeCurrentStreak(overWeekend, 'weekdays', null)).toBe(2)
    // same gap under daily mode: Sat/Sun were scheduled → broken
    expect(computeCurrentStreak(overWeekend, 'daily', null)).toBe(1)
  })

  it('repairs double-booked days: a completed day with a missed sibling still counts', () => {
    // The pre-fix reminder dedupe could leave completed@09:00 + missed@22:00 on
    // the same day; the day must count as done and the streak must survive.
    const rows = desc([
      row({ due_at: shanghai('2026-06-10', '22:00:00'), status: 'missed' }),
      row({ due_at: shanghai('2026-06-10', '09:00:00'), status: 'completed' }),
      row({ due_at: shanghai('2026-06-09'), status: 'completed' }),
    ])
    expect(computeCurrentStreak(rows, 'daily', null)).toBe(2)
  })
})

// ── current state ──────────────────────────────────────────────────────────

describe('buildCurrentState', () => {
  const now = Date.parse(shanghai('2026-06-10', '23:00:00'))

  it('surfaces an overdue same-day pending as pending', () => {
    const rows = desc([row({ due_at: shanghai('2026-06-10'), status: 'pending' })])
    const state = buildCurrentState('note_1', dailySeed, rows, now)
    expect(state.status).toBe('pending')
    expect(state.synthetic).toBeUndefined()
  })

  it('acts on the EARLIEST open row when today and a postponed successor coexist', () => {
    const rows = desc([
      row({ due_at: shanghai('2026-06-11'), status: 'pending' }),
      row({ due_at: shanghai('2026-06-10'), status: 'pending' }),
    ])
    const state = buildCurrentState('note_1', dailySeed, rows, now)
    expect(state.dueAt).toBe(shanghai('2026-06-10'))
    expect(state.status).toBe('pending')
  })

  it('ignores stale past-day pendings awaiting reconciliation', () => {
    const rows = desc([row({ due_at: shanghai('2026-06-09'), status: 'pending' })])
    const state = buildCurrentState('note_1', dailySeed, rows, now)
    // falls through to synthetic next-due instead of yesterday's overdue row
    expect(state.synthetic).toBe(true)
  })

  it('shows completed when today has a completion, even with a missed sibling row on top', () => {
    const rows = desc([
      row({ due_at: shanghai('2026-06-10', '23:30:00'), status: 'missed' }),
      row({ due_at: shanghai('2026-06-10', '09:00:00'), status: 'completed' }),
    ])
    const state = buildCurrentState('note_1', dailySeed, rows, now)
    expect(state.status).toBe('completed')
  })

  it("yesterday's completion does not count for today (new day → synthetic pending)", () => {
    const rows = desc([row({ due_at: shanghai('2026-06-09'), status: 'completed' })])
    const state = buildCurrentState('note_1', dailySeed, rows, now)
    expect(state.status).toBe('pending')
    expect(state.synthetic).toBe(true)
  })

  it('treats a terminal delayed row as history, surfacing its pending successor', () => {
    const rows = desc([
      row({ due_at: shanghai('2026-06-11', '09:00:00'), status: 'pending' }),
      row({ due_at: shanghai('2026-06-10'), status: 'delayed', delayed_to: shanghai('2026-06-11', '09:00:00') }),
    ])
    const state = buildCurrentState('note_1', dailySeed, rows, now)
    expect(state.status).toBe('scheduled')
    expect(state.dueAt).toBe(shanghai('2026-06-11', '09:00:00'))
  })

  it('on a scheduled day past its due time, synthetic state stays pending TODAY (doable until midnight)', () => {
    // 2026-06-12 is a Friday; due 22:00 passed at 23:00 — still today's task.
    const fridayNight = Date.parse(shanghai('2026-06-12', '23:00:00'))
    const seed = { ...dailySeed, repeatMode: 'weekdays' }
    const state = buildCurrentState('note_1', seed, [], fridayNight)
    expect(state.synthetic).toBe(true)
    expect(state.dueAt).toBe(shanghai('2026-06-12'))
    expect(state.status).toBe('pending')
  })

  it('synthetic next-due skips non-scheduled days (weekdays habit on Saturday → Monday)', () => {
    // 2026-06-13 is a Saturday — not a weekdays day; next is Monday 06-15.
    const saturday = Date.parse(shanghai('2026-06-13', '10:00:00'))
    const seed = { ...dailySeed, repeatMode: 'weekdays' }
    const state = buildCurrentState('note_1', seed, [], saturday)
    expect(state.synthetic).toBe(true)
    expect(state.dueAt).toBe(shanghai('2026-06-15'))
    expect(state.status).toBe('scheduled')
  })
})

// ── schedule arithmetic ────────────────────────────────────────────────────

describe('computeTodayDueAt / computeNextScheduledDueAt', () => {
  it('re-anchors the original Shanghai wall-clock time onto today', () => {
    const now = Date.parse(shanghai('2026-06-10', '08:00:00'))
    expect(computeTodayDueAt(shanghai('2026-06-01', '22:15:30'), now)).toBe(shanghai('2026-06-10', '22:15:30'))
  })

  it('skips to the next custom repeat day', () => {
    // 2026-06-10 is Wednesday (dow 3); custom Mon(1)/Fri(5) → Friday 06-12
    const now = Date.parse(shanghai('2026-06-10', '23:30:00'))
    expect(computeNextScheduledDueAt(shanghai('2026-06-01'), 'custom', [1, 5], now)).toBe(shanghai('2026-06-12'))
  })
})

describe('advanceDueAt', () => {
  const now = new Date(shanghai('2026-06-10', '22:05:00'))

  it('advances a daily tag to the next future occurrence', () => {
    expect(advanceDueAt(shanghai('2026-06-10'), 'daily', null, now)).toBe(shanghai('2026-06-11'))
  })

  it('collapses a long-overdue daily tag into a single upcoming occurrence', () => {
    expect(advanceDueAt(shanghai('2026-06-01'), 'daily', null, now)).toBe(shanghai('2026-06-11'))
  })

  it('weekdays mode skips the Shanghai weekend', () => {
    // Friday 06-12 22:00 + weekdays → Monday 06-15
    const fri = new Date(shanghai('2026-06-12', '22:05:00'))
    expect(advanceDueAt(shanghai('2026-06-12'), 'weekdays', null, fri)).toBe(shanghai('2026-06-15'))
  })

  it('returns the input untouched for a non-advancing mode', () => {
    expect(advanceDueAt(shanghai('2026-06-10'), 'once', null, now)).toBe(shanghai('2026-06-10'))
  })
})
