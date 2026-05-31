// Shared @due tag parser used by check-reminders (server), getMemoAgendaItems (server),
// and editor utilities (client). Keep this file free of server-only imports.

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
    const days = spec.slice(7).split(',').map(Number).filter((d) => !isNaN(d) && d >= 0 && d <= 6)
    // A custom repeat with no valid weekdays is meaningless and would never
    // advance (causing an every-tick resend loop), so degrade it to a one-off.
    if (days.length === 0) return { repeatMode: 'once', repeatDays: null }
    return { repeatMode: 'custom', repeatDays: days }
  }
  return { repeatMode: 'once', repeatDays: null }
}

// Calendar day-of-week (0=Sun … 6=Sat) in Asia/Shanghai. Shared by the reminder
// dispatcher and the habit-reschedule logic so both agree on which weekday a due
// time falls on — a task at 01:00 Shanghai (+08:00) is 17:00 UTC the previous day,
// so getUTCDay() would return the wrong weekday for weekday/custom modes.
export function getShanghaiWeekday(date: Date): number {
  const abbr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(abbr)
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
