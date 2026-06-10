// Canonical Asia/Shanghai calendar utilities. Client-safe (Intl only, no server
// imports). All memo/note-board day-boundary logic — habit occurrences, agenda,
// calendar heatmap, reminder weekday math — must go through these helpers instead
// of redefining them locally: the system's day boundary is Shanghai midnight, and
// a UTC (or browser-local) reimplementation shifts tasks onto the wrong day.

export function getShanghaiDateParts(ts: string | Date): { year: number; month: number; day: number } {
  const date = typeof ts === 'string' ? new Date(ts) : ts
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value ?? 0),
    month: Number(parts.find((p) => p.type === 'month')?.value ?? 0),
    day: Number(parts.find((p) => p.type === 'day')?.value ?? 0),
  }
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Shanghai calendar day of the given instant, as a sortable 'YYYY-MM-DD' key. */
export function toShanghaiDateKey(ts: string | Date): string {
  const { year, month, day } = getShanghaiDateParts(ts)
  return toDateKey(year, month, day)
}

/** Shanghai wall-clock time of the given instant, as 'HH:mm'. */
export function getShanghaiTimeKey(iso: string): string {
  const { hour, minute } = getShanghaiHourMinute(iso)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function getShanghaiHourMinute(iso: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso))
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  }
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

export function getMsUntilNextShanghaiMidnight(now = new Date()): number {
  const { year, month, day } = getShanghaiDateParts(now)
  const nextMidnight = new Date(`${toDateKey(year, month, day)}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000
  return Math.max(1_000, nextMidnight - now.getTime() + 1_000)
}
