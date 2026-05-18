'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'

export type NoteColorThemeId = 'vivid' | 'cream' | 'mono' | 'dusk' | 'linen'

export interface NoteColorSlot {
  bg: string   // sticky note face background
  bg2: string  // depth / shadow face
  ink: string  // readable text color against bg
  tape: string // tape & stream-card accent bar
}

export interface NoteColorThemeConfig {
  id: NoteColorThemeId
  label: string
  subtitle: string
  /** bg values only — used for preview dots */
  colors: readonly string[]
  /** full 7-slot palette (rose · butter · mint · sky · lilac · lavender · sage) */
  slots: readonly NoteColorSlot[]
  /** two saturated stop colors for the shell radial gradient (top-left, bottom-right) */
  shell: readonly [string, string]
}

const VALID_IDS = new Set<NoteColorThemeId>(['vivid', 'cream', 'mono', 'dusk', 'linen'])

// ── Theme data ────────────────────────────────────────────────────────────────

const THEME_SLOTS: Record<NoteColorThemeId, readonly NoteColorSlot[]> = {
  // 01 · Vivid 明亮 — high-saturation macaroon, classic first impression
  vivid: [
    { bg: '#fbd9d3', bg2: '#f4c0b6', ink: '#5a2820', tape: '#f29a87' }, // rose
    { bg: '#fbe9a0', bg2: '#f3d878', ink: '#5a4818', tape: '#d6b045' }, // butter
    { bg: '#bfe4cf', bg2: '#9bd1b1', ink: '#1f4a35', tape: '#7fb495' }, // mint
    { bg: '#c8def0', bg2: '#a8c8e2', ink: '#1d3f5a', tape: '#85a6c6' }, // sky
    { bg: '#e5d0e8', bg2: '#cfb4d4', ink: '#412447', tape: '#b388ba' }, // lilac
    { bg: '#d8caea', bg2: '#bfacdc', ink: '#322050', tape: '#a288c8' }, // lavender
    { bg: '#d6dbb8', bg2: '#bdc395', ink: '#3a4220', tape: '#9aa57a' }, // sage
  ],

  // 02 · Cream 奶油 — desaturated warm, sun-faded note paper
  cream: [
    { bg: '#f4dad3', bg2: '#ebc6bc', ink: '#5a342b', tape: '#e0a896' }, // rose
    { bg: '#f6e9bd', bg2: '#ead68f', ink: '#5b4a23', tape: '#d2b664' }, // butter
    { bg: '#cce0cd', bg2: '#a9c4ab', ink: '#2a4636', tape: '#8aae90' }, // mint
    { bg: '#cdd8de', bg2: '#aabac3', ink: '#274050', tape: '#86a2ae' }, // sky
    { bg: '#e0d3df', bg2: '#c8b6c7', ink: '#42304a', tape: '#b095ad' }, // lilac
    { bg: '#d4cbe1', bg2: '#bcafd3', ink: '#33294f', tape: '#a190c5' }, // lavender
    { bg: '#d8d8c0', bg2: '#bcbb9b', ink: '#3b4127', tape: '#a39e78' }, // sage
  ],

  // 03 · Mono 低饱和 — near-desaturated, color as subtle tint only
  mono: [
    { bg: '#ebe6dc', bg2: '#dcd4c4', ink: '#2a2722', tape: '#c4b9a4' }, // rose
    { bg: '#f1ebd9', bg2: '#e2dac0', ink: '#2a2722', tape: '#cabd97' }, // butter
    { bg: '#e6e6d9', bg2: '#d5d5c0', ink: '#2a2722', tape: '#bcbc97' }, // mint
    { bg: '#e3e6e8', bg2: '#cdd2d5', ink: '#2a2722', tape: '#b1b9bc' }, // sky
    { bg: '#e8e4e8', bg2: '#d3cdd3', ink: '#2a2722', tape: '#b6abb6' }, // lilac
    { bg: '#e1ddea', bg2: '#cbc4d8', ink: '#2a2722', tape: '#ab9dc1' }, // lavender
    { bg: '#dfe1cf', bg2: '#c9ccb0', ink: '#2a2722', tape: '#abaf90' }, // sage
  ],

  // 04 · Dusk 黄昏 — warm orange-purple, lamplight paper feel
  dusk: [
    { bg: '#e8b8a8', bg2: '#d99e8a', ink: '#4a2418', tape: '#c8826e' }, // rose
    { bg: '#e8c890', bg2: '#d4ae6b', ink: '#4a3815', tape: '#bf944f' }, // butter
    { bg: '#b4c8a8', bg2: '#9bb18b', ink: '#2c3c25', tape: '#86a075' }, // mint
    { bg: '#b8c4ce', bg2: '#9eaeba', ink: '#2a3848', tape: '#8898a6' }, // sky
    { bg: '#d4b8d0', bg2: '#bd9eba', ink: '#3c2240', tape: '#a684a2' }, // lilac
    { bg: '#c0b0d2', bg2: '#a594bc', ink: '#2e2046', tape: '#8e7ca8' }, // lavender
    { bg: '#c4c4a0', bg2: '#aaaa84', ink: '#34381c', tape: '#92926a' }, // sage
  ],

  // 05 · Linen 亚麻 — unified parchment base, ink & tape carry the identity
  linen: [
    { bg: '#f4ede0', bg2: '#e8e0d0', ink: '#9a3a28', tape: '#c85440' }, // rose
    { bg: '#f4ede0', bg2: '#e8e0d0', ink: '#8a6a15', tape: '#c89640' }, // butter
    { bg: '#f4ede0', bg2: '#e8e0d0', ink: '#2a5a40', tape: '#5a9070' }, // mint
    { bg: '#f4ede0', bg2: '#e8e0d0', ink: '#2a4868', tape: '#5078a0' }, // sky
    { bg: '#f4ede0', bg2: '#e8e0d0', ink: '#5a2868', tape: '#9858a8' }, // lilac
    { bg: '#f4ede0', bg2: '#e8e0d0', ink: '#3828a0', tape: '#6850b8' }, // lavender
    { bg: '#f4ede0', bg2: '#e8e0d0', ink: '#3a4818', tape: '#7a8a48' }, // sage
  ],
}

// Shell gradient stop colors — more saturated than sticky bg values for visible shell tint
const THEME_SHELL: Record<NoteColorThemeId, readonly [string, string]> = {
  vivid:  ['#f8d878', '#c8b0f8'], // butter gold top-left · lavender bottom-right
  cream:  ['#f0d098', '#e8b8c8'], // honey top-left · dusty rose bottom-right
  mono:   ['#d8d0c4', '#c4ccd0'], // warm taupe top-left · cool grey bottom-right
  dusk:   ['#e8a858', '#a888c8'], // amber top-left · dusk purple bottom-right
  linen:  ['#e8c888', '#a8b8d0'], // parchment gold top-left · slate blue bottom-right
}

function buildTheme(
  id: NoteColorThemeId,
  label: string,
  subtitle: string,
): NoteColorThemeConfig {
  const slots = THEME_SLOTS[id]
  return { id, label, subtitle, slots, colors: slots.map((s) => s.bg), shell: THEME_SHELL[id] }
}

export const NOTE_COLOR_THEMES: readonly NoteColorThemeConfig[] = [
  buildTheme('vivid',  '明亮', 'Vivid'),
  buildTheme('cream',  '奶油', 'Cream'),
  buildTheme('mono',   '低饱和', 'Mono'),
  buildTheme('dusk',   '黄昏', 'Dusk'),
  buildTheme('linen',  '亚麻', 'Linen'),
]

// ── Context ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'note-color-theme'
const DEFAULT_THEME = NOTE_COLOR_THEMES[0]

interface NoteColorThemeContextValue {
  theme: NoteColorThemeConfig
  setThemeId: (id: NoteColorThemeId) => void
}

const NoteColorThemeContext = createContext<NoteColorThemeContextValue>({
  theme: DEFAULT_THEME,
  setThemeId: () => {},
})

function getStoredThemeId(): NoteColorThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && VALID_IDS.has(stored as NoteColorThemeId)) return stored as NoteColorThemeId
  } catch {}
  return 'vivid'
}

function subscribeStorage(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

export function NoteColorThemeProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore handles SSR/hydration correctly:
  // server snapshot = 'vivid', client snapshot = actual localStorage value.
  // No useEffect needed — React reconciles the two automatically.
  const themeId = useSyncExternalStore(
    subscribeStorage,
    getStoredThemeId,
    () => 'vivid' as NoteColorThemeId,
  )

  const handleSetThemeId = (id: NoteColorThemeId) => {
    localStorage.setItem(STORAGE_KEY, id)
    // Dispatch a synthetic storage event so the same-tab subscriber re-reads immediately
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: id }))
  }

  const theme = NOTE_COLOR_THEMES.find((t) => t.id === themeId) ?? DEFAULT_THEME

  return (
    <NoteColorThemeContext.Provider value={{ theme, setThemeId: handleSetThemeId }}>
      {children}
    </NoteColorThemeContext.Provider>
  )
}

export function useNoteColorTheme(): NoteColorThemeContextValue {
  return useContext(NoteColorThemeContext)
}
