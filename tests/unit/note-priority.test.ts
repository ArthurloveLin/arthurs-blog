import { describe, it, expect } from 'vitest'

import {
  isNotePriority,
  isNoteSortDirection,
  isNoteSortMode,
  normalizeNotePriority,
} from '@/lib/note-priority'

describe('normalizeNotePriority', () => {
  it('accepts valid numeric priorities', () => {
    expect(normalizeNotePriority(0)).toBe(0)
    expect(normalizeNotePriority(1)).toBe(1)
    expect(normalizeNotePriority(2)).toBe(2)
  })

  it('parses numeric strings', () => {
    expect(normalizeNotePriority('2')).toBe(2)
    expect(normalizeNotePriority(' 0 ')).toBe(0)
  })

  it('falls back to the default (1) for out-of-range or garbage input', () => {
    expect(normalizeNotePriority(3)).toBe(1)
    expect(normalizeNotePriority('foo')).toBe(1)
    expect(normalizeNotePriority(null)).toBe(1)
    expect(normalizeNotePriority(undefined)).toBe(1)
  })
})

describe('isNotePriority', () => {
  it('is true only for the numbers 0, 1, 2', () => {
    expect(isNotePriority(0)).toBe(true)
    expect(isNotePriority(2)).toBe(true)
    expect(isNotePriority(3)).toBe(false)
    expect(isNotePriority('1')).toBe(false) // strings are not priorities
  })
})

describe('isNoteSortMode / isNoteSortDirection', () => {
  it('validates the allowed enum values', () => {
    expect(isNoteSortMode('time')).toBe(true)
    expect(isNoteSortMode('priority')).toBe(true)
    expect(isNoteSortMode('color')).toBe(false)

    expect(isNoteSortDirection('asc')).toBe(true)
    expect(isNoteSortDirection('desc')).toBe(true)
    expect(isNoteSortDirection('up')).toBe(false)
  })
})
