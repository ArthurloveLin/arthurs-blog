import { describe, it, expect } from 'vitest'

import { cleanLyrics, extractData } from '../src/scraper'

describe('extractData', () => {
  it('parses a clean embedded JSON object', () => {
    expect(extractData('{"a":1}')).toEqual({ a: 1 })
  })

  it('slices from the first { to the last } and ignores surrounding JS', () => {
    expect(extractData('window.__state = {"a":1};\nmore();')).toEqual({ a: 1 })
  })

  it("unescapes Genius's JS-string escaping (\\' \\\" \\\\)", () => {
    // Source chars: {"name":"O\'Brien"} with the quote backslash-escaped
    expect(extractData('{\\"name\\":\\"O\'Brien\\"}')).toEqual({ name: "O'Brien" })
  })

  it('truncates at the parse-error position and retries when JS is appended', () => {
    // first { .. last } spans the trailing junk; retry truncates back to valid JSON
    expect(extractData('{"a":1}xx}')).toEqual({ a: 1 })
  })

  it('returns null when there is no JSON object', () => {
    expect(extractData('no braces here')).toBeNull()
  })
})

describe('cleanLyrics', () => {
  it('returns empty string for empty input', () => {
    expect(cleanLyrics('')).toBe('')
  })

  it('decodes the common HTML entities', () => {
    expect(cleanLyrics('Rock &amp; Roll &quot;hi&quot; &#x27;s')).toBe('Rock & Roll "hi" \'s')
  })

  it('drops everything up to and including a Read More marker', () => {
    const out = cleanLyrics('contrib noise Read More[Verse 1]\nthe words')
    expect(out).not.toContain('noise')
    expect(out).toContain('[Verse 1]')
    expect(out).toContain('the words')
  })

  it('strips a "N Contributors ... Lyrics" metadata prefix', () => {
    const out = cleanLyrics('5 Contributors Song Title Lyrics [Verse]\nhi')
    expect(out).not.toContain('Contributors')
    expect(out).toContain('[Verse]')
    expect(out).toContain('hi')
  })

  it('isolates section tags onto their own lines', () => {
    const lines = cleanLyrics('[Intro]a[Chorus]b').split('\n')
    expect(lines).toContain('[Intro]')
    expect(lines).toContain('[Chorus]')
  })
})
