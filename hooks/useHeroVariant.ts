'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { HeroVariantId } from '@/lib/hero-variants'
import { DEFAULT_HERO_VARIANT, HERO_VARIANT_IDS } from '@/lib/hero-variants'

const STORAGE_KEY = 'hero-variant'
// Same-tab notifier: the native `storage` event only fires in *other* tabs, so
// setVariant dispatches this to tell subscribers in the current tab to re-read.
const CHANGE_EVENT = 'hero-variant-change'

function isHeroVariantId(value: string | null): value is HeroVariantId {
  return value != null && (HERO_VARIANT_IDS as readonly string[]).includes(value)
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
  }
}

function getSnapshot(): HeroVariantId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isHeroVariantId(stored) ? stored : DEFAULT_HERO_VARIANT
  } catch {
    return DEFAULT_HERO_VARIANT
  }
}

function getServerSnapshot(): HeroVariantId {
  return DEFAULT_HERO_VARIANT
}

/**
 * Homepage hero variant preference, persisted in localStorage.
 *
 * Backed by useSyncExternalStore so it is hydration-safe without a manual mount
 * gate: server and the hydrating client both read getServerSnapshot (DEFAULT),
 * matching the ISR-prerendered HTML, then React re-renders with the stored value
 * right after hydration. (A variant changes rendered DOM, not just a CSS
 * attribute like site-theme, so reading localStorage during render would trip a
 * hydration mismatch.) The subscribe wiring also keeps every open tab in sync.
 */
export function useHeroVariant() {
  const variant = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setVariant = useCallback((id: HeroVariantId) => {
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { variant, setVariant }
}
