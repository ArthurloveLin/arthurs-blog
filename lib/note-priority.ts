export const NOTE_PRIORITY_VALUES = [0, 1, 2] as const

export type NotePriority = (typeof NOTE_PRIORITY_VALUES)[number]

export const DEFAULT_NOTE_PRIORITY: NotePriority = 1

export const NOTE_SORT_MODES = ['time', 'priority'] as const

export type NoteSortMode = (typeof NOTE_SORT_MODES)[number]

export const NOTE_SORT_DIRECTIONS = ['desc', 'asc'] as const

export type NoteSortDirection = (typeof NOTE_SORT_DIRECTIONS)[number]

export interface NotePriorityMeta {
  label: string
  shortLabel: string
  color: string
  tint: string
  ring: string
}

export const NOTE_PRIORITY_META: Record<NotePriority, NotePriorityMeta> = {
  0: {
    label: '低优先级',
    shortLabel: '低',
    color: '#94a3b8',
    tint: 'rgba(148, 163, 184, 0.14)',
    ring: 'rgba(148, 163, 184, 0.36)',
  },
  1: {
    label: '中优先级',
    shortLabel: '中',
    color: '#f59e0b',
    tint: 'rgba(245, 158, 11, 0.14)',
    ring: 'rgba(245, 158, 11, 0.32)',
  },
  2: {
    label: '高优先级',
    shortLabel: '高',
    color: '#ef4444',
    tint: 'rgba(239, 68, 68, 0.14)',
    ring: 'rgba(239, 68, 68, 0.34)',
  },
}

export function isNotePriority(value: unknown): value is NotePriority {
  return typeof value === 'number' && NOTE_PRIORITY_VALUES.includes(value as NotePriority)
}

export function normalizeNotePriority(value: unknown): NotePriority {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10)
    if (isNotePriority(parsed)) {
      return parsed
    }
  }

  if (isNotePriority(value)) {
    return value
  }

  return DEFAULT_NOTE_PRIORITY
}

export function isNoteSortMode(value: unknown): value is NoteSortMode {
  return typeof value === 'string' && NOTE_SORT_MODES.includes(value as NoteSortMode)
}

export function isNoteSortDirection(value: unknown): value is NoteSortDirection {
  return typeof value === 'string' && NOTE_SORT_DIRECTIONS.includes(value as NoteSortDirection)
}