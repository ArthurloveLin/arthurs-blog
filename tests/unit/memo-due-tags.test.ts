import { describe, it, expect } from 'vitest'

import {
  hasInlineDueTags,
  parseInlineDueTags,
  parseRepeatSpec,
  stripInlineDueTags,
} from '@/lib/memo-due-tags'
import { getShanghaiWeekday } from '@/lib/shanghai-time'

describe('parseRepeatSpec', () => {
  it('maps the simple modes', () => {
    expect(parseRepeatSpec('')).toEqual({ repeatMode: 'once', repeatDays: null })
    expect(parseRepeatSpec('daily')).toEqual({ repeatMode: 'daily', repeatDays: null })
    expect(parseRepeatSpec('weekly')).toEqual({ repeatMode: 'weekly', repeatDays: null })
    expect(parseRepeatSpec('monthly')).toEqual({ repeatMode: 'monthly', repeatDays: null })
    expect(parseRepeatSpec('weekdays')).toEqual({ repeatMode: 'weekdays', repeatDays: null })
  })

  it('parses custom weekdays and clamps out-of-range days', () => {
    expect(parseRepeatSpec('custom:0,1,2')).toEqual({ repeatMode: 'custom', repeatDays: [0, 1, 2] })
    expect(parseRepeatSpec('custom:1,7')).toEqual({ repeatMode: 'custom', repeatDays: [1] }) // 7 dropped
  })

  it('degrades a custom spec with no usable days to once (prevents every-tick resend loop)', () => {
    // 'foo' → NaN, '9' → out of 0..6, both filtered → empty → degrade.
    expect(parseRepeatSpec('custom:foo,9')).toEqual({ repeatMode: 'once', repeatDays: null })
    // Empty spec: tokens are dropped before Number() so it no longer leaks day 0.
    expect(parseRepeatSpec('custom:')).toEqual({ repeatMode: 'once', repeatDays: null })
  })

  it('treats an unknown spec as once', () => {
    expect(parseRepeatSpec('yearly')).toEqual({ repeatMode: 'once', repeatDays: null })
  })
})

describe('parseInlineDueTags', () => {
  it('parses a single tag with a repeat spec', () => {
    const tags = parseInlineDueTags('do it @due[Pay rent](2026-06-07T10:00:00+08:00,monthly) ok')
    expect(tags).toHaveLength(1)
    expect(tags[0].label).toBe('Pay rent')
    expect(tags[0].repeatMode).toBe('monthly')
    expect(tags[0].iso).toBe('2026-06-07T10:00:00+08:00')
  })

  it('parses multiple tags and defaults to once when no repeat spec', () => {
    const tags = parseInlineDueTags('@due[A](2026-06-07T10:00:00Z) @due[B](2026-06-08T10:00:00Z,daily)')
    expect(tags.map((t) => t.label)).toEqual(['A', 'B'])
    expect(tags[0].repeatMode).toBe('once')
    expect(tags[1].repeatMode).toBe('daily')
  })

  it('skips tags whose iso is missing or unparseable', () => {
    expect(parseInlineDueTags('@due[X](not-a-date)')).toEqual([])
    expect(parseInlineDueTags('@due[Y](,daily)')).toEqual([])
  })
})

describe('stripInlineDueTags / hasInlineDueTags', () => {
  it('replaces a tag with its trimmed label', () => {
    expect(stripInlineDueTags('pay @due[ rent ](2026-06-07T10:00:00Z) now')).toBe('pay rent now')
  })

  it('detects presence without full parsing', () => {
    expect(hasInlineDueTags('@due[x](2026-06-07T10:00:00Z)')).toBe(true)
    expect(hasInlineDueTags('no tags here')).toBe(false)
  })
})

describe('getShanghaiWeekday', () => {
  it('returns a valid 0..6 weekday', () => {
    const wd = getShanghaiWeekday(new Date('2026-06-07T08:00:00Z'))
    expect(wd).toBeGreaterThanOrEqual(0)
    expect(wd).toBeLessThanOrEqual(6)
  })

  it('rolls to the next weekday across the Shanghai midnight boundary (+08:00)', () => {
    const beforeMidnight = new Date('2026-06-07T15:30:00Z') // 23:30 Shanghai, Jun 7
    const afterMidnight = new Date('2026-06-07T16:30:00Z') // 00:30 Shanghai, Jun 8
    expect(getShanghaiWeekday(afterMidnight)).toBe((getShanghaiWeekday(beforeMidnight) + 1) % 7)
  })

  it('differs from getUTCDay() when the UTC and Shanghai dates diverge', () => {
    const d = new Date('2026-06-07T16:30:00Z') // still Jun 7 in UTC, already Jun 8 in Shanghai
    expect(getShanghaiWeekday(d)).toBe((d.getUTCDay() + 1) % 7)
  })
})
