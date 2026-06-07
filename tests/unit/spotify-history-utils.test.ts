import { afterEach, describe, it, expect, vi } from 'vitest'

import {
  buildWeekDayKeys,
  formatCompactDateLabel,
  formatDateLabel,
  formatWeekdayLabel,
  getCurrentTimeSegmentId,
  segmentTracksByTime,
} from '@/lib/spotify-history-utils'
import type { SpotifyRecentlyPlayedTrack } from '@/lib/spotify-types'

// Only `.playedAt` is read by the time-grouping helpers.
const track = (playedAt: string) => ({ playedAt } as unknown as SpotifyRecentlyPlayedTrack)

afterEach(() => {
  vi.useRealTimers()
})

describe('buildWeekDayKeys', () => {
  it('anchors the week on Monday and treats Sunday as day 7', () => {
    // 2026-06-07 is a Sunday → its week is Mon 2026-06-01 .. Sun 2026-06-07.
    expect(buildWeekDayKeys('2026-06-07')).toEqual([
      '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04',
      '2026-06-05', '2026-06-06', '2026-06-07',
    ])
  })

  it('returns the same Monday-anchored week for any mid-week anchor', () => {
    expect(buildWeekDayKeys('2026-06-03')).toEqual(buildWeekDayKeys('2026-06-07'))
  })

  it('defaults to the current week when the anchor is null', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T12:00:00+08:00'))
    expect(buildWeekDayKeys(null)).toEqual(buildWeekDayKeys('2026-06-07'))
  })
})

describe('segmentTracksByTime', () => {
  it('buckets tracks by Shanghai hour with exclusive end boundaries', () => {
    const grouped = segmentTracksByTime([
      track('2026-06-07T05:59:00+08:00'), // hour 5 → dawn (0..6)
      track('2026-06-07T06:00:00+08:00'), // hour 6 → morning (6..9), not dawn
      track('2026-06-07T23:30:00+08:00'), // hour 23 → night (21..24)
    ])
    expect(grouped.get('dawn')).toHaveLength(1)
    expect(grouped.get('morning')).toHaveLength(1)
    expect(grouped.get('night')).toHaveLength(1)
    expect(grouped.get('afternoon')).toHaveLength(0)
  })
})

describe('getCurrentTimeSegmentId', () => {
  it('resolves the segment from the current Shanghai hour', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T12:00:00+08:00')) // hour 12 → afternoon
    expect(getCurrentTimeSegmentId()).toBe('afternoon')
  })
})

describe('date label helpers', () => {
  it('formats relative labels around today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T12:00:00+08:00'))
    expect(formatDateLabel('2026-06-07')).toBe('今天')
    expect(formatDateLabel('2026-06-06')).toBe('昨天')
    expect(formatDateLabel('2026-06-05')).toBe('6月5日')
  })

  it('formats weekday and compact labels', () => {
    expect(formatWeekdayLabel('2026-06-07')).toBe('周日') // Sunday
    expect(formatWeekdayLabel('2026-06-01')).toBe('周一') // Monday
    expect(formatCompactDateLabel('2026-06-03')).toBe('06/03')
  })
})
