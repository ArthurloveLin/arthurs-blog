'use client'

import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
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

  // Drive the data-hero-variant gate across the post-hydration swap.
  //
  // The inline <head> script sets data-hero-variant pre-paint ONLY when the stored variant
  // differs from the ISR default — i.e. exactly when a load-time swap is pending. We record
  // that on mount, then on the swap commit (Render 2) RE-ASSERT the attribute synchronously
  // before the browser paints. The re-assert matters because React can strip the inline
  // script's attribute during hydration (same reason SiteThemeInitializer exists); without
  // it the gate + CSS intro-suppression would lapse and the swapped-in variant would replay
  // its reveal animation — the flash this fixes. useLayoutEffect (not useEffect) guarantees
  // it runs before paint. After paint we drop the attribute so later user-initiated switches
  // animate normally.
  const mountedRef = useRef(false)
  const pendingLoadSwapRef = useRef(false)
  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      pendingLoadSwapRef.current = document.documentElement.hasAttribute('data-hero-variant')
      return
    }
    if (pendingLoadSwapRef.current) {
      pendingLoadSwapRef.current = false
      document.documentElement.setAttribute('data-hero-variant', variant)
      const id = requestAnimationFrame(() => {
        document.documentElement.removeAttribute('data-hero-variant')
      })
      return () => cancelAnimationFrame(id)
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
