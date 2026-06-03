'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { HeroVariantId } from '@/lib/hero-variants'
import { DEFAULT_HERO_VARIANT, HERO_VARIANT_IDS } from '@/lib/hero-variants'
import { useSiteConfig } from '@/components/SiteDataProvider'

const STORAGE_KEY = 'hero-variant'
// Same-tab notifier: the native `storage` event only fires in *other* tabs, so
// setVariant dispatches this to tell subscribers in the current tab to re-read.
const CHANGE_EVENT = 'hero-variant-change'

function isHeroVariantId(value: string | null | undefined): value is HeroVariantId {
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

/**
 * Homepage hero variant preference, persisted in localStorage.
 *
 * The server-rendered default is read from site_config (hero_default_variant),
 * falling back to DEFAULT_HERO_VARIANT when not configured. This drives both
 * getServerSnapshot (hydration safety) and getSnapshot (fallback for new visitors).
 *
 * The subscribe wiring keeps every open tab in sync.
 */
export function useHeroVariant() {
  const config = useSiteConfig()
  const serverDefault: HeroVariantId = isHeroVariantId(config.hero_default_variant)
    ? config.hero_default_variant
    : DEFAULT_HERO_VARIANT

  // Both snapshot functions use serverDefault so new visitors and hydration always
  // reflect the DB-configured default, not the hardcoded compile-time constant.
  const getSnapshot = useCallback((): HeroVariantId => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return isHeroVariantId(stored) ? stored : serverDefault
    } catch {
      return serverDefault
    }
  }, [serverDefault])

  const getServerSnapshot = useCallback((): HeroVariantId => serverDefault, [serverDefault])

  const variant = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Remove the CSS gate only after the stored preference is committed to the DOM.
  // DEFAULT is 'terminal', so this only matters for aurora users: skip Render 1 (the
  // ISR-rendered default) and remove the gate on Render 2 (after aurora is shown).
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    document.documentElement.removeAttribute('data-hero-variant')
  }, [variant])

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
