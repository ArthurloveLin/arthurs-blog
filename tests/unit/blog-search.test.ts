import { describe, it, expect } from 'vitest'

import {
  buildSearchSnippet,
  escapeRegExp,
  normalizeSearchQuery,
  splitHighlightedText,
  stripMarkdownToText,
  tokenizeSearchQuery,
} from '@/lib/blog-search'

describe('normalizeSearchQuery / tokenizeSearchQuery', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeSearchQuery('  a   b  ')).toBe('a b')
  })

  it('splits into non-empty tokens', () => {
    expect(tokenizeSearchQuery('  hello   world ')).toEqual(['hello', 'world'])
    expect(tokenizeSearchQuery('   ')).toEqual([])
  })
})

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c+(d)')).toBe('a\\.b\\*c\\+\\(d\\)')
  })
})

describe('stripMarkdownToText', () => {
  it('strips code, links, images, headings and markup', () => {
    const md = '# Title\n\nSome `code` and [link](http://example.com) then ```\nblock\n``` end'
    const out = stripMarkdownToText(md)
    expect(out).toContain('Title')
    expect(out).toContain('link')
    expect(out).toContain('end')
    // link href, fenced code body, inline-code ticks and heading hashes all gone
    expect(out).not.toContain('http')
    expect(out).not.toContain('block')
    expect(out).not.toContain('`')
    expect(out).not.toContain('#')
  })

  it('keeps wikilink display text', () => {
    expect(stripMarkdownToText('see ![[image.png|alt text]] here')).toContain('image.png')
  })
})

describe('buildSearchSnippet', () => {
  it('returns empty string for empty text', () => {
    expect(buildSearchSnippet('   ', 'q')).toBe('')
  })

  it('windows around the first matched token with ellipses', () => {
    const text = `${'x'.repeat(100)}NEEDLE${'y'.repeat(100)}`
    const snippet = buildSearchSnippet(text, 'NEEDLE')
    expect(snippet).toContain('NEEDLE')
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('falls back to a prefix slice when nothing matches', () => {
    expect(buildSearchSnippet('hello world', 'zzz', 5)).toBe('hello')
  })

  it('falls back to a prefix slice when the query has no tokens', () => {
    expect(buildSearchSnippet('hello world', '   ', 5)).toBe('hello')
  })
})

describe('splitHighlightedText', () => {
  it('marks matched tokens case-insensitively', () => {
    const parts = splitHighlightedText('Hello World', 'world')
    expect(parts).toEqual([
      { text: 'Hello ', match: false },
      { text: 'World', match: true },
    ])
  })

  it('returns the whole text unmarked when there are no tokens', () => {
    expect(splitHighlightedText('Hello', '   ')).toEqual([{ text: 'Hello', match: false }])
  })
})
