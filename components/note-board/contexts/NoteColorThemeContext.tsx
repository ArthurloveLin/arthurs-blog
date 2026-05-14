'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type NoteColorThemeId = 'vivid' | 'cream' | 'mono'

export interface NoteColorThemeConfig {
  id: NoteColorThemeId
  label: string
  subtitle: string
  colors: readonly string[]
}

export const NOTE_COLOR_THEMES: readonly NoteColorThemeConfig[] = [
  {
    id: 'vivid',
    label: '明亮',
    subtitle: 'Vivid',
    // High saturation macaroon: sat 65–80%, lightness 82–88%
    colors: ['#f8ef9f', '#ffd0a8', '#f8bfd3', '#c9eff3', '#d9ccff'],
  },
  {
    id: 'cream',
    label: '奶油',
    subtitle: 'Cream',
    // Lower saturation (35–48%), warm-shifted, feels like sun-faded note paper
    colors: ['#f0ebd0', '#f2e2d3', '#f2d6de', '#ddebed', '#e0d9eb'],
  },
  {
    id: 'mono',
    label: '低饱和',
    subtitle: 'Mono',
    // Near-desaturated (5–9%), color as subtle tint only
    colors: ['#eceade', '#ece7e0', '#ece6e8', '#e5eaec', '#e8e6ec'],
  },
] as const

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

export function NoteColorThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: reads from localStorage on first client render only
  const [themeId, setThemeId] = useState<NoteColorThemeId>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'cream' || stored === 'mono' || stored === 'vivid') return stored
    }
    return 'vivid'
  })

  const handleSetThemeId = (id: NoteColorThemeId) => {
    setThemeId(id)
    localStorage.setItem(STORAGE_KEY, id)
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
