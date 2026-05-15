export type MarkdownThemeId = 'mono' | 'spectral' | 'polar' | 'sakura' | 'sage'

export interface MarkdownTheme {
  id: MarkdownThemeId
  name: string
  label: string
  preview: {
    light: readonly [string, string, string, string]
    dark: readonly [string, string, string, string]
  }
}

export const MARKDOWN_THEMES: readonly MarkdownTheme[] = [
  {
    id: 'mono',
    name: '墨色',
    label: '默认无彩色',
    preview: {
      light: ['#111111', '#2d2d2d', '#555555', '#6b6b6b'],
      dark:  ['#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373'],
    },
  },
  {
    id: 'spectral',
    name: '光谱',
    label: '彩虹层级',
    preview: {
      light: ['#b91c1c', '#c2410c', '#15803d', '#1d4ed8'],
      dark:  ['#f87171', '#fb923c', '#4ade80', '#60a5fa'],
    },
  },
  {
    id: 'polar',
    name: '极地',
    label: '北欧冰蓝',
    preview: {
      light: ['#1e3a5f', '#2e5987', '#1e7a8a', '#2a7a5b'],
      dark:  ['#88c0d0', '#81a1c1', '#8fbcbb', '#a3be8c'],
    },
  },
  {
    id: 'sakura',
    name: '樱花',
    label: '玫粉薰衣',
    preview: {
      light: ['#9f1239', '#c026d3', '#7c3aed', '#0f766e'],
      dark:  ['#fb7185', '#e879f9', '#c084fc', '#2dd4bf'],
    },
  },
  {
    id: 'sage',
    name: '苍翠',
    label: '森林草绿',
    preview: {
      light: ['#14532d', '#166534', '#4d7c0f', '#0f766e'],
      dark:  ['#4ade80', '#86efac', '#bef264', '#2dd4bf'],
    },
  },
] as const

export const DEFAULT_MARKDOWN_THEME: MarkdownThemeId = 'mono'
