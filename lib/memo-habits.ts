export type MemoHabitRepeatMode = 'once' | 'daily' | 'weekdays' | 'custom'

export type MemoHabitOccurrenceStatus = 'scheduled' | 'pending' | 'completed' | 'missed' | 'delayed'

export type MemoHabitCompletionSource = 'manual_check' | 'reminder_confirm'

export interface MemoHabitChecklistItem {
  itemKey: string
  lineIndex: number
  checked: boolean
  checkboxText: string
  lineText: string
  label: string
  dueAt: string
  repeatMode: MemoHabitRepeatMode
  repeatDays: number[] | null
}

export interface MemoHabitCurrentState {
  noteId: string
  itemKey: string
  label: string
  lineText: string
  dueAt: string
  status: MemoHabitOccurrenceStatus
  streak: number
  reminderSentAt?: string | null
  completedAt?: string | null
  delayedTo?: string | null
  completionSource?: MemoHabitCompletionSource | null
}

export interface MemoHabitDaySummary {
  date: string
  completed: number
  missed: number
  delayed: number
}

export interface MemoHabitHistoryEvent {
  occurrenceId: string
  noteId: string
  itemKey: string
  label: string
  lineText: string
  status: Extract<MemoHabitOccurrenceStatus, 'completed' | 'missed' | 'delayed'>
  dueAt: string
  occurredAt: string
  delayedTo?: string | null
  completionSource?: MemoHabitCompletionSource | null
}

export interface MemoHabitOverviewSummary {
  completedToday: number
  currentStreak: number
  completionRate7d: number
  missedThisWeek: number
  delayedThisWeek: number
}

export interface MemoHabitOverview {
  summary: MemoHabitOverviewSummary
  currentStates: Record<string, Record<string, MemoHabitCurrentState>>
  daySummaries: MemoHabitDaySummary[]
  recentEvents: MemoHabitHistoryEvent[]
}

export interface MemoHabitItemDetail {
  noteId: string
  itemKey: string
  label: string
  lineText: string
  currentState: MemoHabitCurrentState | null
  nextDueAt?: string | null
  recentOccurrences: MemoHabitHistoryEvent[]
}

const CHECKLIST_LINE_RE = /^[-*]\s+\[( |x|X)\]\s+(.*)$/
const INLINE_DUE_RE = /@due\[([^\]]*)\]\(([^)]*)\)/

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function parseDueParens(raw: string): { iso: string; repeatSpec: string } {
  const comma = raw.indexOf(',')
  if (comma === -1) return { iso: raw, repeatSpec: '' }
  return { iso: raw.slice(0, comma), repeatSpec: raw.slice(comma + 1) }
}

function replaceChecklistMarker(line: string, checked: boolean) {
  return line.replace(/^([-*]\s+\[)( |x|X)(\]\s+)/, `$1${checked ? 'x' : ' '}$3`)
}

export function parseMemoHabitRepeatSpec(spec: string): { repeatMode: MemoHabitRepeatMode; repeatDays: number[] | null } {
  if (!spec) return { repeatMode: 'once', repeatDays: null }
  if (spec === 'daily') return { repeatMode: 'daily', repeatDays: null }
  if (spec === 'weekdays') return { repeatMode: 'weekdays', repeatDays: null }
  if (spec.startsWith('custom:')) {
    const repeatDays = spec
      .slice(7)
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    return { repeatMode: 'custom', repeatDays: repeatDays.length > 0 ? repeatDays : null }
  }
  return { repeatMode: 'once', repeatDays: null }
}

function getScheduleSignature(dueAt: string, repeatMode: MemoHabitRepeatMode, repeatDays: number[] | null) {
  if (repeatMode === 'once') {
    return dueAt
  }

  const timeSignature = dueAt.length > 10 ? dueAt.slice(11, 16) : '00:00'
  return `${repeatMode}|${repeatDays?.join(',') ?? ''}|${timeSignature}`
}

function fnv1a(input: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function createMemoHabitItemKey(signature: string) {
  return `habit_${fnv1a(signature)}`
}

export function extractMemoHabitChecklistItems(content: string): MemoHabitChecklistItem[] {
  const lines = content.split('\n')
  const duplicateCounts = new Map<string, number>()
  const items: MemoHabitChecklistItem[] = []

  for (const [lineIndex, line] of lines.entries()) {
    const checklistMatch = line.match(CHECKLIST_LINE_RE)
    if (!checklistMatch) {
      continue
    }

    const checkboxText = checklistMatch[2]
    const dueMatch = checkboxText.match(INLINE_DUE_RE)
    if (!dueMatch) {
      continue
    }

    const { iso, repeatSpec } = parseDueParens(dueMatch[2])
    if (!iso || Number.isNaN(Date.parse(iso))) {
      continue
    }

    const label = dueMatch[1].trim() || checkboxText.replace(dueMatch[0], '').trim() || '截止'
    const lineText = checkboxText.replace(dueMatch[0], '').replace(/\s+/g, ' ').trim()
    const { repeatMode, repeatDays } = parseMemoHabitRepeatSpec(repeatSpec)
    const signatureBase = [
      normalizeText(lineText),
      normalizeText(label),
      getScheduleSignature(iso, repeatMode, repeatDays),
    ].join('|')
    const occurrenceIndex = (duplicateCounts.get(signatureBase) ?? 0) + 1
    duplicateCounts.set(signatureBase, occurrenceIndex)

    items.push({
      itemKey: createMemoHabitItemKey(`${signatureBase}#${occurrenceIndex}`),
      lineIndex,
      checked: checklistMatch[1].toLocaleLowerCase() === 'x',
      checkboxText,
      lineText,
      label,
      dueAt: iso,
      repeatMode,
      repeatDays,
    })
  }

  return items
}

export function updateMemoHabitChecklistLine(
  content: string,
  lineIndex: number,
  updates: { checked?: boolean; dueAt?: string },
) {
  const lines = content.split('\n')
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return content
  }

  let nextLine = lines[lineIndex] ?? ''
  if (typeof updates.checked === 'boolean') {
    nextLine = replaceChecklistMarker(nextLine, updates.checked)
  }

  if (typeof updates.dueAt === 'string' && updates.dueAt) {
    nextLine = nextLine.replace(INLINE_DUE_RE, (_match, label: string, rawParens: string) => {
      const { repeatSpec } = parseDueParens(rawParens)
      const nextParens = repeatSpec ? `${updates.dueAt},${repeatSpec}` : updates.dueAt
      return `@due[${label}](${nextParens})`
    })
  }

  lines[lineIndex] = nextLine
  return lines.join('\n')
}