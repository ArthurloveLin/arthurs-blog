import { describe, it, expect } from 'vitest'

import { isAllowedHostname } from '../src/index'

describe('isAllowedHostname (SSRF allowlist)', () => {
  it('allows the apex and subdomains of the permitted CDNs', () => {
    expect(isAllowedHostname('i.scdn.co')).toBe(true)
    expect(isAllowedHostname('scdn.co')).toBe(true) // apex via suffix.slice(1)
    expect(isAllowedHostname('image.spotifycdn.com')).toBe(true)
    expect(isAllowedHostname('spotifycdn.com')).toBe(true)
  })

  it('rejects look-alike and suffix-smuggling hostnames', () => {
    expect(isAllowedHostname('evil.com')).toBe(false)
    expect(isAllowedHostname('notscdn.co')).toBe(false) // no dot boundary
    expect(isAllowedHostname('scdn.co.attacker.com')).toBe(false) // allowlisted label as prefix
    expect(isAllowedHostname('i.scdn.co.evil.com')).toBe(false)
    expect(isAllowedHostname('')).toBe(false)
  })
})
