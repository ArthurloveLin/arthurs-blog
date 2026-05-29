import type { MarkdownThemeId } from '@/lib/markdown-themes'

/**
 * Site-wide (chrome) themes. Share the SAME identity set as MARKDOWN_THEMES
 * (id / name / icon), but the picker swatches preview the CHROME palette
 * (primary · accent · surface) rather than prose heading colors.
 *
 * Applied via the `data-site-theme` attribute on <html>, orthogonal to the
 * `.dark` class from next-themes — so every theme works in both light & dark.
 * See app/globals.css for the actual token definitions.
 */
export type SiteThemeId = MarkdownThemeId

export interface SiteTheme {
  id: SiteThemeId
  name: string
  icon: string
  /** primary · accent · surface — drives the 3 preview dots */
  preview: {
    light: readonly [string, string, string]
    dark: readonly [string, string, string]
  }
}

// Canonical order shared with MARKDOWN_THEMES — keep in sync.
export const SITE_THEMES: readonly SiteTheme[] = [
  {
    id: 'mono',
    name: '墨色',
    icon: '🖋',
    preview: {
      light: ['#7c3aed', '#8b8b94', '#f5f4f2'],
      dark:  ['#a78bfa', '#a1a1aa', '#0a0a0a'],
    },
  },
  {
    id: 'polar',
    name: '极地',
    icon: '❄️',
    preview: {
      light: ['#5e81ac', '#81a1c1', '#e7ecf3'],
      dark:  ['#88c0d0', '#81a1c1', '#0e1622'],
    },
  },
  {
    id: 'tide',
    name: '碧波',
    icon: '🌊',
    preview: {
      light: ['#0d9488', '#0891b2', '#e6f7f6'],
      dark:  ['#5eead4', '#22d3ee', '#08191c'],
    },
  },
  {
    id: 'sage',
    name: '苍翠',
    icon: '🌿',
    preview: {
      light: ['#15803d', '#0f766e', '#ecf5ed'],
      dark:  ['#4ade80', '#2dd4bf', '#0a1810'],
    },
  },
  {
    id: 'amber',
    name: '琥珀',
    icon: '🌅',
    preview: {
      light: ['#ea580c', '#d97706', '#fdf3e9'],
      dark:  ['#fb923c', '#fbbf24', '#1c1206'],
    },
  },
  {
    id: 'sakura',
    name: '樱花',
    icon: '🌸',
    preview: {
      light: ['#c1567a', '#9079b3', '#fbedf1'],
      dark:  ['#eb6f92', '#c4a7e7', '#22101a'],
    },
  },
  {
    id: 'night',
    name: '紫夜',
    icon: '🌙',
    preview: {
      light: ['#4338ca', '#6d28d9', '#edeefb'],
      dark:  ['#818cf8', '#a78bfa', '#0b0a1e'],
    },
  },
  {
    id: 'spectral',
    name: '光谱',
    icon: '🌈',
    preview: {
      light: ['#b91c1c', '#15803d', '#1d4ed8'],
      dark:  ['#f87171', '#4ade80', '#60a5fa'],
    },
  },
] as const

export const DEFAULT_SITE_THEME: SiteThemeId = 'mono'

export const SITE_THEME_IDS = SITE_THEMES.map((t) => t.id) as readonly SiteThemeId[]
