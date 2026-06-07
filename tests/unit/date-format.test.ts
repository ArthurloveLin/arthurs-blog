import { describe, it, expect } from 'vitest'

import {
  formatLongDate,
  formatStableDate,
  getStableYear,
  hasEditedTimestamp,
  parseBlogFrontmatterDate,
} from '@/lib/date-format'

describe('parseBlogFrontmatterDate', () => {
  it('treats a date-only string as Shanghai midnight (+08:00)', () => {
    // 2026-06-07 00:00 +08:00 === 2026-06-06 16:00 UTC
    expect(parseBlogFrontmatterDate('2026-06-07')).toBe('2026-06-06T16:00:00.000Z')
  })

  it('treats a zoneless datetime as Shanghai local', () => {
    // 2026-06-07 12:30 +08:00 === 2026-06-07 04:30 UTC
    expect(parseBlogFrontmatterDate('2026-06-07 12:30')).toBe('2026-06-07T04:30:00.000Z')
    expect(parseBlogFrontmatterDate('2026-06-07T12:30')).toBe('2026-06-07T04:30:00.000Z')
  })

  it('normalizes seconds and milliseconds in a zoneless datetime', () => {
    expect(parseBlogFrontmatterDate('2026-06-07T12:30:45.5')).toBe('2026-06-07T04:30:45.500Z')
  })

  it('passes a Date instance through as ISO', () => {
    const d = new Date('2026-01-02T03:04:05.000Z')
    expect(parseBlogFrontmatterDate(d)).toBe('2026-01-02T03:04:05.000Z')
  })

  it('accepts an epoch-millis number', () => {
    expect(parseBlogFrontmatterDate(0)).toBe('1970-01-01T00:00:00.000Z')
  })

  it('falls back for invalid, empty, or non-string input', () => {
    const fallback = new Date('2000-01-01T00:00:00.000Z')
    const iso = fallback.toISOString()
    expect(parseBlogFrontmatterDate('not a date', fallback)).toBe(iso)
    expect(parseBlogFrontmatterDate('', fallback)).toBe(iso)
    expect(parseBlogFrontmatterDate(null, fallback)).toBe(iso)
    expect(parseBlogFrontmatterDate({}, fallback)).toBe(iso)
    expect(parseBlogFrontmatterDate(new Date('nope'), fallback)).toBe(iso)
  })
})

describe('formatStableDate / formatLongDate', () => {
  it('returns an empty string for an invalid date', () => {
    expect(formatStableDate('garbage', { year: 'numeric' })).toBe('')
  })

  it('formats in the Asia/Shanghai zone regardless of host TZ', () => {
    // 2026-06-06 16:00 UTC === 2026-06-07 in Shanghai → "2026年6月7日"
    const out = formatLongDate('2026-06-06T16:00:00.000Z')
    expect(out).toContain('2026')
    expect(out).toContain('7')
  })
})

describe('hasEditedTimestamp', () => {
  it('is false when updatedAt is missing', () => {
    expect(hasEditedTimestamp('2026-06-07T00:00:00Z')).toBe(false)
    expect(hasEditedTimestamp('2026-06-07T00:00:00Z', null)).toBe(false)
  })

  it('uses a strict 1-second threshold (> 1000ms counts as edited)', () => {
    const base = '2026-06-07T00:00:00.000Z'
    expect(hasEditedTimestamp(base, '2026-06-07T00:00:01.000Z')).toBe(false) // exactly 1000ms
    expect(hasEditedTimestamp(base, '2026-06-07T00:00:01.001Z')).toBe(true) // 1001ms
  })

  it('is false when either timestamp is invalid', () => {
    expect(hasEditedTimestamp('bad', '2026-06-07T00:00:05Z')).toBe(false)
    expect(hasEditedTimestamp('2026-06-07T00:00:00Z', 'bad')).toBe(false)
  })
})

describe('getStableYear', () => {
  it('extracts the Shanghai-local year, including across the UTC boundary', () => {
    expect(getStableYear('2026-06-06T16:00:00.000Z')).toBe(2026) // 2026-06-07 in Shanghai
    expect(getStableYear('2025-12-31T16:00:00.000Z')).toBe(2026) // 2026-01-01 in Shanghai
  })
})
