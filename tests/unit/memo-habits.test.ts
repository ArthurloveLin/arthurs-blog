import { describe, it, expect } from 'vitest'

import {
  extractMemoHabitChecklistItems,
  parseMemoHabitRepeatSpec,
  updateMemoHabitChecklistLine,
} from '@/lib/memo-habits'

describe('parseMemoHabitRepeatSpec', () => {
  it('only tracks daily/weekdays/custom as habits (weekly/monthly are reminder-only)', () => {
    expect(parseMemoHabitRepeatSpec('daily').repeatMode).toBe('daily')
    expect(parseMemoHabitRepeatSpec('weekdays').repeatMode).toBe('weekdays')
    expect(parseMemoHabitRepeatSpec('custom:1,3,5')).toEqual({ repeatMode: 'custom', repeatDays: [1, 3, 5] })
    expect(parseMemoHabitRepeatSpec('weekly').repeatMode).toBe('once')
    expect(parseMemoHabitRepeatSpec('monthly').repeatMode).toBe('once')
  })
})

describe('extractMemoHabitChecklistItems — itemKey stability', () => {
  const utcLine = '- [ ] 晨间锻炼 @due[锻炼](2026-06-10T14:00:00.000Z,daily)'
  const offsetLine = '- [ ] 晨间锻炼 @due[锻炼](2026-06-10T22:00:00+08:00,daily)'

  it('produces the same itemKey for the same instant in UTC and +08:00 form', () => {
    // The reminder cron rewrites hand-written +08:00 tags to UTC ISO on the first
    // advance; if the key changed across that rewrite, all occurrence history
    // (and the streak) would be orphaned.
    const [utcItem] = extractMemoHabitChecklistItems(utcLine)
    const [offsetItem] = extractMemoHabitChecklistItems(offsetLine)
    expect(utcItem.itemKey).toBe(offsetItem.itemKey)
  })

  it('keeps the itemKey stable across daily date advances (time-only signature)', () => {
    const advanced = '- [ ] 晨间锻炼 @due[锻炼](2026-06-11T14:00:00.000Z,daily)'
    const [before] = extractMemoHabitChecklistItems(utcLine)
    const [after] = extractMemoHabitChecklistItems(advanced)
    expect(before.itemKey).toBe(after.itemKey)
  })

  it('changes the itemKey when the time-of-day changes', () => {
    const movedTime = '- [ ] 晨间锻炼 @due[锻炼](2026-06-10T13:00:00.000Z,daily)'
    const [before] = extractMemoHabitChecklistItems(utcLine)
    const [after] = extractMemoHabitChecklistItems(movedTime)
    expect(before.itemKey).not.toBe(after.itemKey)
  })

  it('skips once items and lines without @due', () => {
    const content = ['- [ ] 普通清单项', '- [ ] 一次性 @due[一次](2026-06-10T14:00:00.000Z)', utcLine].join('\n')
    const items = extractMemoHabitChecklistItems(content)
    expect(items).toHaveLength(1)
    expect(items[0].repeatMode).toBe('daily')
  })
})

describe('updateMemoHabitChecklistLine', () => {
  it('unchecks the marker and advances the due ISO while preserving the repeat spec', () => {
    const content = '- [x] 晨间锻炼 @due[锻炼](2026-06-10T14:00:00.000Z,daily)'
    const next = updateMemoHabitChecklistLine(content, 0, { checked: false, dueAt: '2026-06-11T14:00:00.000Z' })
    expect(next).toBe('- [ ] 晨间锻炼 @due[锻炼](2026-06-11T14:00:00.000Z,daily)')
  })
})
