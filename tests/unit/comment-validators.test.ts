import { describe, it, expect } from 'vitest'

import {
  isReactionValue,
  normalizeReactionIdentity,
  normalizeReactionValue,
} from '@/lib/comment-reactions'
import { normalizeEmoji } from '@/lib/comment-emojis'

describe('normalizeReactionValue', () => {
  it('coerces up/down votes from number or string, else 0', () => {
    expect(normalizeReactionValue(1)).toBe(1)
    expect(normalizeReactionValue('1')).toBe(1)
    expect(normalizeReactionValue(-1)).toBe(-1)
    expect(normalizeReactionValue('-1')).toBe(-1)
    expect(normalizeReactionValue(0)).toBe(0)
    expect(normalizeReactionValue(2)).toBe(0)
    expect(normalizeReactionValue('x')).toBe(0)
    expect(normalizeReactionValue(null)).toBe(0)
  })
})

describe('isReactionValue', () => {
  it('is true only for the active votes 1 and -1', () => {
    expect(isReactionValue(1)).toBe(true)
    expect(isReactionValue(-1)).toBe(true)
    expect(isReactionValue(0)).toBe(false)
    expect(isReactionValue('1')).toBe(false)
  })
})

describe('normalizeReactionIdentity', () => {
  it('trims strings and rejects non-strings', () => {
    expect(normalizeReactionIdentity('  abc ')).toBe('abc')
    expect(normalizeReactionIdentity('')).toBe('')
    expect(normalizeReactionIdentity(123)).toBe('')
    expect(normalizeReactionIdentity(null)).toBe('')
  })
})

describe('normalizeEmoji', () => {
  it('trims and accepts a short emoji string', () => {
    expect(normalizeEmoji('👍')).toBe('👍')
    expect(normalizeEmoji('  🎉 ')).toBe('🎉')
  })

  it('rejects empty, whitespace-only, over-long, or non-string input', () => {
    expect(normalizeEmoji('')).toBeNull()
    expect(normalizeEmoji('   ')).toBeNull()
    expect(normalizeEmoji('x'.repeat(25))).toBeNull() // > 24 chars
    expect(normalizeEmoji(123)).toBeNull()
  })
})
