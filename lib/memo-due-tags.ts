// Shared @due tag parser used by check-reminders (server), getMemoAgendaItems (server),
// and editor utilities (client). Keep this file free of server-only imports.

import { getShanghaiWeekday } from '@/lib/shanghai-time'

export interface InlineDueTag {
  label: string
  iso: string
  repeatMode: string
  repeatDays: number[] | null
  fullMatch: string
  rawParens: string
}

function splitDueParens(raw: string): { iso: string; repeatSpec: string } {
  const comma = raw.indexOf(',')
  if (comma === -1) return { iso: raw, repeatSpec: '' }
  return { iso: raw.slice(0, comma), repeatSpec: raw.slice(comma + 1) }
}

export function parseRepeatSpec(spec: string): { repeatMode: string; repeatDays: number[] | null } {
  if (!spec) return { repeatMode: 'once', repeatDays: null }
  if (spec === 'daily') return { repeatMode: 'daily', repeatDays: null }
  if (spec === 'weekly') return { repeatMode: 'weekly', repeatDays: null }
  if (spec === 'monthly') return { repeatMode: 'monthly', repeatDays: null }
  if (spec === 'weekdays') return { repeatMode: 'weekdays', repeatDays: null }
  if (spec.startsWith('custom:')) {
    // Drop empty tokens before Number(): Number('') === 0 would otherwise let an
    // empty spec ("custom:") slip through as a phantom day-0 (Sunday) repeat.
    const days = spec.slice(7).split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((d) => !isNaN(d) && d >= 0 && d <= 6)
    // A custom repeat with no valid weekdays is meaningless and would never
    // advance (causing an every-tick resend loop), so degrade it to a one-off.
    if (days.length === 0) return { repeatMode: 'once', repeatDays: null }
    return { repeatMode: 'custom', repeatDays: days }
  }
  return { repeatMode: 'once', repeatDays: null }
}

// Hard cap on advance iterations (~10 years of daily steps). Guards against a
// non-advancing repeat mode hanging the caller, and bounds back-fill catch-up.
const MAX_ADVANCE_ITERATIONS = 3660

// Advance ISO to the *next future* occurrence for the given repeat mode. We keep
// stepping until the result is strictly after `now`, so a back-filled or long-
// overdue task collapses into a single upcoming occurrence instead of replaying
// one notification per missed period on every cron tick. UTC date arithmetic;
// weekday checks are converted to the Asia/Shanghai calendar day.
//
// NOT the same as computeNextScheduledDueAt (lib/memo-habits-state.ts): this one
// steps a CONTENT TAG's ISO forward period-by-period for the reminder dispatcher;
// that one computes a synthetic occurrence due_at anchored to today's Shanghai date.
export function advanceDueAt(dueAt: string, repeatMode: string, repeatDays: number[] | null, now: Date): string {
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

// Tag format: @due[label](iso) or @due[label](iso,daily|weekly|monthly|weekdays|custom:0,1,2)
export function parseInlineDueTags(content: string): InlineDueTag[] {
  const re = /@due\[([^\]]*)\]\(([^)]*)\)/g
  const result: InlineDueTag[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const { iso, repeatSpec } = splitDueParens(match[2])
    if (!iso || isNaN(Date.parse(iso))) continue
    const { repeatMode, repeatDays } = parseRepeatSpec(repeatSpec)
    result.push({ label: match[1], iso, repeatMode, repeatDays, fullMatch: match[0], rawParens: match[2] })
  }
  return result
}

// Replace @due[label](...) with just the label text (for notification body generation).
export function stripInlineDueTags(content: string): string {
  return content.replace(/@due\[([^\]]*)\]\([^)]*\)/g, (_, label: string) => label.trim())
}

// Fast presence check — does not require full parsing.
export function hasInlineDueTags(content: string): boolean {
  return /@due\[[^\]]*\]\([^)]*\)/.test(content)
}
