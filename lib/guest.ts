const GUEST_ID_KEY = 'guest_id'

const GUEST_ADJECTIVES = [
  'Amber',
  'Aster',
  'Cedar',
  'Cinder',
  'Cloud',
  'Dawn',
  'Echo',
  'Ember',
  'Harbor',
  'Ivy',
  'Juniper',
  'Linen',
  'Maple',
  'Moss',
  'Nova',
  'River',
  'Sable',
  'Solstice',
  'Velvet',
  'Willow',
] as const

const GUEST_NOUNS = [
  'Atlas',
  'Bloom',
  'Comet',
  'Finch',
  'Grove',
  'Harbor',
  'Lark',
  'Meadow',
  'Orbit',
  'Pine',
  'Ripple',
  'Sparrow',
  'Star',
  'Stone',
  'Tide',
  'Trail',
  'Vale',
  'Wave',
  'Wren',
  'Yard',
] as const

function hashGuestSeed(value: string) {
  let hash = 0

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash
}

export function getGuestDisplayName(guestId: string): string {
  if (!guestId) return ''

  const normalized = guestId.replace(/^guest_/, '')
  const hash = hashGuestSeed(normalized)
  const adjective = GUEST_ADJECTIVES[hash % GUEST_ADJECTIVES.length]
  const noun = GUEST_NOUNS[Math.floor(hash / GUEST_ADJECTIVES.length) % GUEST_NOUNS.length]
  const suffix = (hash % 1296).toString(36).padStart(2, '0').toUpperCase()

  return `${adjective}${noun}-${suffix}`
}

export function getGuestIdentityAliases(guestId: string): string[] {
  if (!guestId) return []

  const aliases = [guestId, getGuestDisplayName(guestId)]
  return Array.from(new Set(aliases.filter(Boolean)))
}

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return ''

  const existing = localStorage.getItem(GUEST_ID_KEY)
  if (existing) return existing

  const shortUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  const guestId = `guest_${shortUuid}`
  localStorage.setItem(GUEST_ID_KEY, guestId)
  return guestId
}
