export type MarkdownThemeId =
  | 'mono'
  | 'polar'
  | 'tide'
  | 'sage'
  | 'amber'
  | 'sakura'
  | 'night'
  | 'spectral'

export interface MarkdownTheme {
  id: MarkdownThemeId
  name: string
  label: string
  /** Emoji icon representing the theme's character */
  icon: string
  /** H1 / H2 / H3 representative colors for the swatch preview */
  preview: {
    light: readonly [string, string, string]
    dark: readonly [string, string, string]
  }
}

// Canonical order (shared with SITE_THEMES): neutral → cool → teal → green → warm → pink → violet → prism.
// The 2×4 picker grid reads left-to-right, top-to-bottom in this order.
export const MARKDOWN_THEMES: readonly MarkdownTheme[] = [
  {
    id: 'mono',
    name: '墨色',
    label: '无彩分级',
    icon: '🖋',
    preview: {
      light: ['#0f0f0f', '#2d2d2d', '#555555'],
      dark:  ['#f5f5f5', '#d4d4d4', '#a3a3a3'],
    },
  },
  {
    id: 'polar',
    name: '极地',
    label: '北欧冰蓝',
    icon: '❄️',
    preview: {
      light: ['#2E3440', '#5E81AC', '#81A1C1'],
      dark:  ['#ECEFF4', '#88C0D0', '#81A1C1'],
    },
  },
  {
    id: 'tide',
    name: '碧波',
    label: '青碧水蓝',
    icon: '🌊',
    preview: {
      light: ['#0d9488', '#0891b2', '#06b6d4'],
      dark:  ['#5eead4', '#22d3ee', '#67e8f9'],
    },
  },
  {
    id: 'sage',
    name: '苍翠',
    label: '幽林草泽',
    icon: '🌿',
    preview: {
      light: ['#14532d', '#15803d', '#0f766e'],
      dark:  ['#4ade80', '#86efac', '#2dd4bf'],
    },
  },
  {
    id: 'amber',
    name: '琥珀',
    label: '暖焰熔金',
    icon: '🌅',
    preview: {
      light: ['#7c2d12', '#c2410c', '#b45309'],
      dark:  ['#fdba74', '#fb923c', '#fbbf24'],
    },
  },
  {
    id: 'sakura',
    name: '樱花',
    label: '玫粉薰衣',
    icon: '🌸',
    preview: {
      light: ['#b4637a', '#286983', '#907aa9'],
      dark:  ['#eb6f92', '#c4a7e7', '#9ccfd8'],
    },
  },
  {
    id: 'night',
    name: '紫夜',
    label: '深蓝星域',
    icon: '🌙',
    preview: {
      light: ['#1e1b4b', '#4338ca', '#6d28d9'],
      dark:  ['#c7d2fe', '#818cf8', '#a78bfa'],
    },
  },
  {
    id: 'spectral',
    name: '光谱',
    label: '彩虹层级',
    icon: '🌈',
    preview: {
      light: ['#b91c1c', '#c2410c', '#a16207'],
      dark:  ['#f87171', '#fb923c', '#fbbf24'],
    },
  },
] as const

export const DEFAULT_MARKDOWN_THEME: MarkdownThemeId = 'mono'
