const GUEST_ID_KEY = 'guest_id'

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return ''

  const existing = localStorage.getItem(GUEST_ID_KEY)
  if (existing) return existing

  const shortUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  const guestId = `guest_${shortUuid}`
  localStorage.setItem(GUEST_ID_KEY, guestId)
  return guestId
}
