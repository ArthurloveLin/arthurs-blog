'use client'

import { createContext, use, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { type NoteColorThemeId, isValidNoteThemeId } from '@/lib/note-color-theme'

export type { NoteColorThemeId }

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
  /** emoji icon shown in the theme picker */
  icon: string
  /** bg values only — used for preview dots */
  colors: readonly string[]
  /** full 7-slot palette (rose · butter · mint · sky · lilac · lavender · sage) */
  slots: readonly NoteColorSlot[]
  /** two saturated stop colors for the shell radial gradient (top-left, bottom-right) */
  shell: readonly [string, string]
  /** full memo shell / control / card chrome tokens */
  chrome: NoteColorThemeChrome
}

export interface NoteColorThemeChrome {
  shellSurface: string
  shellBorder: string
  shellShadow: string
  heading: string
  summary: string
  muted: string
  controlSurface: string
  controlBorder: string
  controlText: string
  controlHoverSurface: string
  controlHoverText: string
  controlActiveSurface: string
  controlActiveText: string
  panelSurface: string
  panelMutedSurface: string
  panelBorder: string
  panelShadow: string
  cardSurface: string
  cardEditingSurface: string
  cardBorder: string
  cardHoverBorder: string
  cardText: string
  cardMuted: string
  cardShadow: string
  cardHoverShadow: string
  filterSurface: string
  filterBorder: string
  filterText: string
  primarySurface: string
  primaryText: string
}

// ── Theme data ────────────────────────────────────────────────────────────────

const THEME_SLOTS: Record<NoteColorThemeId, readonly NoteColorSlot[]> = {
  // 00 · Classic 默认 — high-saturation macaroon, original pastel rainbow
  classic: [
    { bg: '#fbd9d3', bg2: '#f4c0b6', ink: '#5a2820', tape: '#f29a87' }, // rose
    { bg: '#fbe9a0', bg2: '#f3d878', ink: '#5a4818', tape: '#d6b045' }, // butter
    { bg: '#bfe4cf', bg2: '#9bd1b1', ink: '#1f4a35', tape: '#7fb495' }, // mint
    { bg: '#c8def0', bg2: '#a8c8e2', ink: '#1d3f5a', tape: '#85a6c6' }, // sky
    { bg: '#e5d0e8', bg2: '#cfb4d4', ink: '#412447', tape: '#b388ba' }, // lilac
    { bg: '#d8caea', bg2: '#bfacdc', ink: '#322050', tape: '#a288c8' }, // lavender
    { bg: '#d6dbb8', bg2: '#bdc395', ink: '#3a4220', tape: '#9aa57a' }, // sage
  ],

  // 01 · Vivid 明亮 — ocean-inspired, teal & indigo core with warm coral accent
  vivid: [
    { bg: '#cce8f4', bg2: '#aad4e8', ink: '#143d52', tape: '#2b8ebb' }, // ocean
    { bg: '#d0e6f8', bg2: '#b0d0ef', ink: '#1a3a58', tape: '#4a8dc4' }, // azure
    { bg: '#b8e4e0', bg2: '#94d4ce', ink: '#134240', tape: '#2a9d8f' }, // teal
    { bg: '#f6d7cf', bg2: '#edbaad', ink: '#512f28', tape: '#e76f51' }, // coral
    { bg: '#e0d7f0', bg2: '#cbbde6', ink: '#3a2a5a', tape: '#6366f1' }, // indigo
    { bg: '#f7e2b2', bg2: '#ebcd82', ink: '#544120', tape: '#e9c46a' }, // sand
    { bg: '#c4e2d0', bg2: '#a4d2b8', ink: '#1f4a3a', tape: '#3da87a' }, // seafoam
  ],

  // 02 · Cream 奶油 — refined natural paper, soft earth neutrals
  cream: [
    { bg: '#e3e8cf', bg2: '#ccd5ae', ink: '#44502f', tape: '#a6b97a' },
    { bg: '#f2f1d9', bg2: '#e9edc9', ink: '#5a5532', tape: '#c5c883' },
    { bg: '#fff9ec', bg2: '#fefae0', ink: '#615640', tape: '#d8c88a' },
    { bg: '#f6e6d0', bg2: '#faedcd', ink: '#6a533c', tape: '#e5c58b' },
    { bg: '#e6d2bc', bg2: '#d4a373', ink: '#60432c', tape: '#b68253' },
    { bg: '#e7d9d0', bg2: '#d7c1b5', ink: '#6a4a42', tape: '#b98c79' },
    { bg: '#dde2e3', bg2: '#c4ced2', ink: '#42545b', tape: '#8ca0a8' },
  ],

  // 03 · Mono 低饱和 — newsroom grayscale with warm/cool paper tones
  mono: [
    { bg: '#f3eee7', bg2: '#e7ded2', ink: '#211d19', tape: '#aaa095' },
    { bg: '#ece6dd', bg2: '#ddd4c8', ink: '#211d19', tape: '#b2a69a' },
    { bg: '#e4ded7', bg2: '#d0c6bc', ink: '#211d19', tape: '#9d9184' },
    { bg: '#dde3e4', bg2: '#c8d0d3', ink: '#232427', tape: '#8b98a0' },
    { bg: '#e4e0e5', bg2: '#cec6cf', ink: '#232427', tape: '#9b8f9d' },
    { bg: '#e1e2d8', bg2: '#cacdc0', ink: '#232427', tape: '#969a85' },
    { bg: '#d8d6d2', bg2: '#bebab4', ink: '#1f1c18', tape: '#7b746b' },
  ],

  // 04 · Dusk 黄昏 — sunset-inspired, warm terracotta + amber + rose
  dusk: [
    { bg: '#f5cdb8', bg2: '#e8a888', ink: '#4b2215', tape: '#d65d28' }, // burnt orange
    { bg: '#f7ddb0', bg2: '#ecc078', ink: '#5a3e18', tape: '#e8a530' }, // amber
    { bg: '#f2c4c4', bg2: '#e2a0a0', ink: '#5a2028', tape: '#c85050' }, // dusty rose
    { bg: '#f0d0b8', bg2: '#ddb08e', ink: '#553420', tape: '#c07840' }, // sienna
    { bg: '#e8d4c0', bg2: '#d4b898', ink: '#4d3822', tape: '#b08848' }, // caramel
    { bg: '#e0ccc4', bg2: '#ccb0a4', ink: '#46302c', tape: '#9a6e60' }, // clay
    { bg: '#ddd5c8', bg2: '#c8bca8', ink: '#3c3428', tape: '#8a7a60' }, // driftwood
  ],

  // 05 · Linen 亚麻 — forest-inspired, olive garden, deep greens + bark
  linen: [
    { bg: '#d0e4cc', bg2: '#b4d4ae', ink: '#2a4a22', tape: '#4a8838' }, // fern
    { bg: '#dce8c8', bg2: '#c4d8a4', ink: '#344a20', tape: '#5c8028' }, // moss
    { bg: '#ccdcc8', bg2: '#b0c8a4', ink: '#283c20', tape: '#487038' }, // sage
    { bg: '#e4e8d4', bg2: '#ccd4b4', ink: '#3a4228', tape: '#6a7848' }, // lichen
    { bg: '#f0ead4', bg2: '#e0d4b4', ink: '#504020', tape: '#9a8040' }, // straw
    { bg: '#e8e0d0', bg2: '#d4c8b4', ink: '#504438', tape: '#8a7060' }, // bark
    { bg: '#d8dcd4', bg2: '#bcc4b4', ink: '#384038', tape: '#687868' }, // stone
  ],

  // 06 · Sakura 樱花 — soft pink, rose petal, cherry blossom palette
  sakura: [
    { bg: '#fce4ec', bg2: '#f8bbd0', ink: '#5c1a2a', tape: '#e85080' }, // rose
    { bg: '#fde8f0', bg2: '#f9c8da', ink: '#5a1a30', tape: '#e6658c' }, // blush
    { bg: '#f8d7e8', bg2: '#f0b4cc', ink: '#521828', tape: '#d45a7a' }, // petal
    { bg: '#f4d4e8', bg2: '#e8acd0', ink: '#4a1840', tape: '#c45898' }, // mauve
    { bg: '#f0d8f0', bg2: '#e0b8e0', ink: '#421848', tape: '#b85ab8' }, // orchid
    { bg: '#ead0e8', bg2: '#d4b0d4', ink: '#3c1840', tape: '#9c50a0' }, // lavender-rose
    { bg: '#fcd8e4', bg2: '#f4b4c8', ink: '#501828', tape: '#da6080' }, // carnation
  ],

  // 07 · Night 紫夜 — deep violet, indigo, twilight purple
  night: [
    { bg: '#e4dff8', bg2: '#ccc4f0', ink: '#1a1048', tape: '#6448c8' }, // violet
    { bg: '#dcd8f4', bg2: '#c0baec', ink: '#180e40', tape: '#5040b8' }, // purple
    { bg: '#d4dcf8', bg2: '#b4c0f0', ink: '#101848', tape: '#3850c0' }, // indigo
    { bg: '#d8d4f4', bg2: '#beb4ec', ink: '#160e3c', tape: '#5448b8' }, // periwinkle
    { bg: '#e8d8f8', bg2: '#d0b8f0', ink: '#200e48', tape: '#7050c8' }, // deep lilac
    { bg: '#dce0f4', bg2: '#c0c8ec', ink: '#141848', tape: '#4450b8' }, // night blue
    { bg: '#e4d8f4', bg2: '#ccc0ec', ink: '#1c1040', tape: '#6248c0' }, // slate violet
  ],

  // 08 · Dark 暗色 — dark sticky notes, deep hues with light ink
  dark: [
    { bg: '#2d2440', bg2: '#1e1530', ink: '#e4d8f8', tape: '#9070d0' }, // deep violet
    { bg: '#1e2a40', bg2: '#141e2e', ink: '#d8e8f8', tape: '#6088c0' }, // midnight
    { bg: '#1e3028', bg2: '#142018', ink: '#d0f0e0', tape: '#508860' }, // forest night
    { bg: '#302018', bg2: '#201408', ink: '#f0e0c8', tape: '#9a6030' }, // ember
    { bg: '#301828', bg2: '#201018', ink: '#f0d0e0', tape: '#9a5068' }, // dark rose
    { bg: '#282030', bg2: '#181424', ink: '#e4d8f0', tape: '#786898' }, // dusk violet
    { bg: '#202828', bg2: '#141818', ink: '#d0e4e4', tape: '#508888' }, // dark teal
  ],
}

const THEME_SHELL: Record<NoteColorThemeId, readonly [string, string]> = {
  classic: ['#f8d878', '#c8b0f8'], // butter gold · lavender
  vivid: ['#2b8ebb', '#6366f1'],   // ocean blue · indigo
  cream: ['#d4a373', '#ccd5ae'],   // caramel · sage
  mono: ['#b2a69a', '#8b98a0'],    // warm taupe · cool slate
  dusk: ['#d65d28', '#c85050'],    // burnt orange · dusty rose
  linen: ['#4a8838', '#8a7060'],   // fern green · bark brown
  sakura: ['#e85080', '#c45898'],  // rose · mauve
  night: ['#6448c8', '#3850c0'],   // violet · indigo
  dark: ['#9070d0', '#6088c0'],    // violet light · blue light (used for heatmap)
}

const THEME_CHROME: Record<NoteColorThemeId, NoteColorThemeChrome> = {
  // 00 · Classic — chrome tinted with butter gold and lavender, plum heading
  classic: {
    shellSurface: 'linear-gradient(165deg, rgba(255,253,248,0.98) 0%, rgba(250,246,241,0.96) 100%), radial-gradient(circle at 14% 12%, rgba(248,216,120,0.28) 0%, transparent 33%), radial-gradient(circle at 84% 16%, rgba(200,176,248,0.22) 0%, transparent 26%), radial-gradient(circle at 74% 84%, rgba(191,228,207,0.20) 0%, transparent 26%)',
    shellBorder: 'rgba(100,60,140,0.18)',
    shellShadow: '0 30px 90px rgba(90,50,130,0.12)',
    heading: '#4a2878',
    summary: 'rgba(74,40,120,0.58)',
    muted: 'rgba(74,40,120,0.46)',
    controlSurface: 'linear-gradient(180deg, rgba(255,254,250,0.86), rgba(248,244,235,0.84))',
    controlBorder: 'rgba(100,60,140,0.14)',
    controlText: 'rgba(74,40,120,0.68)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(251,247,232,0.98), rgba(244,234,210,0.96))',
    controlHoverText: '#4a2878',
    controlActiveSurface: 'linear-gradient(180deg, rgba(244,232,204,0.98), rgba(234,218,182,0.96))',
    controlActiveText: '#3d1e66',
    panelSurface: 'linear-gradient(180deg, rgba(255,254,252,0.96), rgba(249,246,240,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(252,250,246,0.92), rgba(244,240,234,0.90))',
    panelBorder: 'rgba(100,60,140,0.12)',
    panelShadow: '0 16px 40px rgba(90,50,130,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(250,247,242,0.92))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(251,248,240,0.96), rgba(241,233,218,0.94))',
    cardBorder: 'rgba(100,60,140,0.10)',
    cardHoverBorder: 'rgba(200,176,248,0.28)',
    cardText: 'rgba(50,30,72,0.90)',
    cardMuted: 'rgba(74,40,120,0.50)',
    cardShadow: '0 18px 44px rgba(90,50,130,0.10)',
    cardHoverShadow: '0 26px 58px rgba(90,50,130,0.16)',
    filterSurface: 'rgba(200,176,248,0.12)',
    filterBorder: 'rgba(200,176,248,0.22)',
    filterText: 'rgba(120,72,180,0.82)',
    primarySurface: 'linear-gradient(135deg, #a288c8 0%, #4a2878 100%)',
    primaryText: '#fff8f4',
  },
  vivid: {
    shellSurface: 'linear-gradient(165deg, rgba(245,250,255,0.98) 0%, rgba(236,245,252,0.96) 100%), radial-gradient(circle at 14% 12%, rgba(43,142,187,0.22) 0%, transparent 33%), radial-gradient(circle at 84% 16%, rgba(99,102,241,0.18) 0%, transparent 26%), radial-gradient(circle at 76% 84%, rgba(42,157,143,0.18) 0%, transparent 28%)',
    shellBorder: 'rgba(30,80,120,0.22)',
    shellShadow: '0 30px 90px rgba(30,80,130,0.14)',
    heading: '#143d52',
    summary: 'rgba(20,61,82,0.58)',
    muted: 'rgba(20,61,82,0.46)',
    controlSurface: 'linear-gradient(180deg, rgba(245,250,255,0.88), rgba(232,244,252,0.86))',
    controlBorder: 'rgba(30,80,120,0.14)',
    controlText: 'rgba(20,61,82,0.68)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(232,244,255,0.98), rgba(218,238,252,0.96))',
    controlHoverText: '#143d52',
    controlActiveSurface: 'linear-gradient(180deg, rgba(216,236,252,0.98), rgba(200,228,248,0.96))',
    controlActiveText: '#0e3248',
    panelSurface: 'linear-gradient(180deg, rgba(248,252,255,0.96), rgba(236,245,252,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(242,248,252,0.92), rgba(232,242,248,0.90))',
    panelBorder: 'rgba(30,80,120,0.12)',
    panelShadow: '0 16px 40px rgba(30,80,130,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(250,253,255,0.94), rgba(238,247,253,0.92))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(240,248,255,0.96), rgba(226,240,250,0.94))',
    cardBorder: 'rgba(30,80,120,0.11)',
    cardHoverBorder: 'rgba(43,142,187,0.24)',
    cardText: 'rgba(18,56,76,0.90)',
    cardMuted: 'rgba(20,61,82,0.50)',
    cardShadow: '0 18px 44px rgba(30,80,130,0.10)',
    cardHoverShadow: '0 26px 58px rgba(30,80,130,0.16)',
    filterSurface: 'rgba(43,142,187,0.10)',
    filterBorder: 'rgba(43,142,187,0.18)',
    filterText: 'rgba(30,100,150,0.82)',
    primarySurface: 'linear-gradient(135deg, #2b8ebb 0%, #3a50b0 100%)',
    primaryText: '#f0f8ff',
  },
  cream: {
    shellSurface: 'linear-gradient(180deg, rgba(255,251,243,0.98) 0%, rgba(249,243,229,0.96) 100%), radial-gradient(circle at 13% 16%, rgba(212,163,115,0.22) 0%, transparent 30%), radial-gradient(circle at 84% 14%, rgba(204,213,174,0.22) 0%, transparent 28%), repeating-linear-gradient(90deg, rgba(140,112,83,0.03) 0 1px, transparent 1px 18px)',
    shellBorder: 'rgba(141,117,88,0.26)',
    shellShadow: '0 30px 88px rgba(154,130,101,0.13)',
    heading: '#5b4636',
    summary: 'rgba(91,70,54,0.56)',
    muted: 'rgba(91,70,54,0.44)',
    controlSurface: 'linear-gradient(180deg, rgba(255,251,243,0.88), rgba(248,241,229,0.84))',
    controlBorder: 'rgba(141,117,88,0.16)',
    controlText: 'rgba(91,70,54,0.62)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(249,243,230,0.98), rgba(240,230,206,0.96))',
    controlHoverText: '#5b4636',
    controlActiveSurface: 'linear-gradient(180deg, rgba(238,227,203,0.98), rgba(224,211,180,0.96))',
    controlActiveText: '#543f30',
    panelSurface: 'linear-gradient(180deg, rgba(255,252,246,0.96), rgba(245,239,229,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(250,247,240,0.92), rgba(242,237,228,0.90))',
    panelBorder: 'rgba(141,117,88,0.12)',
    panelShadow: '0 16px 40px rgba(154,130,101,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(255,252,246,0.92), rgba(245,239,229,0.90))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(249,244,235,0.96), rgba(239,231,214,0.94))',
    cardBorder: 'rgba(141,117,88,0.12)',
    cardHoverBorder: 'rgba(212,163,115,0.22)',
    cardText: 'rgba(81,62,46,0.90)',
    cardMuted: 'rgba(91,70,54,0.50)',
    cardShadow: '0 18px 44px rgba(150,126,96,0.10)',
    cardHoverShadow: '0 26px 58px rgba(150,126,96,0.15)',
    filterSurface: 'rgba(212,163,115,0.10)',
    filterBorder: 'rgba(212,163,115,0.17)',
    filterText: 'rgba(167,116,67,0.82)',
    primarySurface: 'linear-gradient(135deg, #8b6a4c 0%, #5b4636 100%)',
    primaryText: '#fff9f1',
  },
  mono: {
    shellSurface: 'linear-gradient(180deg, rgba(248,246,242,0.98) 0%, rgba(238,234,228,0.95) 100%), repeating-linear-gradient(0deg, rgba(33,29,25,0.04) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgba(33,29,25,0.03) 0 1px, transparent 1px 24px)',
    shellBorder: 'rgba(110,101,91,0.22)',
    shellShadow: '0 30px 84px rgba(85,79,72,0.11)',
    heading: '#23201d',
    summary: 'rgba(35,32,29,0.54)',
    muted: 'rgba(35,32,29,0.42)',
    controlSurface: 'linear-gradient(180deg, rgba(251,250,247,0.86), rgba(240,236,231,0.84))',
    controlBorder: 'rgba(110,101,91,0.16)',
    controlText: 'rgba(35,32,29,0.62)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(241,237,231,0.98), rgba(229,224,216,0.96))',
    controlHoverText: '#23201d',
    controlActiveSurface: 'linear-gradient(180deg, rgba(232,227,219,0.98), rgba(219,213,203,0.96))',
    controlActiveText: '#1d1a18',
    panelSurface: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,238,233,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(248,246,243,0.92), rgba(238,235,229,0.90))',
    panelBorder: 'rgba(110,101,91,0.12)',
    panelShadow: '0 14px 34px rgba(85,79,72,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(252,251,249,0.92), rgba(241,238,233,0.90))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(246,243,239,0.96), rgba(232,227,219,0.94))',
    cardBorder: 'rgba(110,101,91,0.12)',
    cardHoverBorder: 'rgba(123,116,107,0.22)',
    cardText: 'rgba(33,29,25,0.90)',
    cardMuted: 'rgba(35,32,29,0.50)',
    cardShadow: '0 16px 38px rgba(85,79,72,0.10)',
    cardHoverShadow: '0 24px 52px rgba(85,79,72,0.14)',
    filterSurface: 'rgba(88,79,70,0.08)',
    filterBorder: 'rgba(88,79,70,0.14)',
    filterText: 'rgba(61,54,48,0.80)',
    primarySurface: 'linear-gradient(135deg, #2f3438 0%, #4a463f 100%)',
    primaryText: '#f8f4ee',
  },
  dusk: {
    shellSurface: 'linear-gradient(180deg, rgba(255,248,240,0.97) 0%, rgba(248,236,222,0.95) 100%), radial-gradient(circle at 14% 12%, rgba(214,93,40,0.22) 0%, transparent 30%), radial-gradient(circle at 86% 16%, rgba(200,80,80,0.18) 0%, transparent 28%), radial-gradient(circle at 72% 84%, rgba(232,165,48,0.16) 0%, transparent 24%)',
    shellBorder: 'rgba(140,60,30,0.24)',
    shellShadow: '0 30px 92px rgba(120,50,25,0.14)',
    heading: '#5a2010',
    summary: 'rgba(90,32,16,0.58)',
    muted: 'rgba(90,32,16,0.46)',
    controlSurface: 'linear-gradient(180deg, rgba(255,250,244,0.88), rgba(248,238,226,0.86))',
    controlBorder: 'rgba(140,60,30,0.14)',
    controlText: 'rgba(90,32,16,0.64)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(252,240,224,0.98), rgba(244,226,204,0.96))',
    controlHoverText: '#5a2010',
    controlActiveSurface: 'linear-gradient(180deg, rgba(244,226,204,0.98), rgba(236,210,184,0.96))',
    controlActiveText: '#4a1808',
    panelSurface: 'linear-gradient(180deg, rgba(255,250,244,0.96), rgba(248,238,226,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(252,244,236,0.92), rgba(244,234,222,0.90))',
    panelBorder: 'rgba(140,60,30,0.11)',
    panelShadow: '0 16px 40px rgba(120,50,25,0.10)',
    cardSurface: 'linear-gradient(180deg, rgba(255,252,248,0.94), rgba(250,240,230,0.92))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(252,244,234,0.96), rgba(244,232,216,0.94))',
    cardBorder: 'rgba(140,60,30,0.12)',
    cardHoverBorder: 'rgba(214,93,40,0.22)',
    cardText: 'rgba(80,28,14,0.90)',
    cardMuted: 'rgba(90,32,16,0.50)',
    cardShadow: '0 18px 44px rgba(120,50,25,0.12)',
    cardHoverShadow: '0 28px 58px rgba(120,50,25,0.18)',
    filterSurface: 'rgba(214,93,40,0.10)',
    filterBorder: 'rgba(214,93,40,0.18)',
    filterText: 'rgba(180,70,28,0.82)',
    primarySurface: 'linear-gradient(135deg, #d65d28 0%, #a04020 100%)',
    primaryText: '#fff5ee',
  },
  linen: {
    shellSurface: 'linear-gradient(180deg, rgba(244,250,244,0.97) 0%, rgba(232,242,232,0.95) 100%), radial-gradient(circle at 15% 15%, rgba(74,136,56,0.18) 0%, transparent 32%), radial-gradient(circle at 87% 14%, rgba(138,112,96,0.16) 0%, transparent 28%), repeating-linear-gradient(90deg, rgba(60,80,48,0.03) 0 1px, transparent 1px 22px)',
    shellBorder: 'rgba(60,90,48,0.22)',
    shellShadow: '0 30px 88px rgba(50,80,40,0.12)',
    heading: '#2a4a22',
    summary: 'rgba(42,74,34,0.56)',
    muted: 'rgba(42,74,34,0.44)',
    controlSurface: 'linear-gradient(180deg, rgba(246,252,246,0.88), rgba(234,244,234,0.86))',
    controlBorder: 'rgba(60,90,48,0.16)',
    controlText: 'rgba(42,74,34,0.62)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(234,246,234,0.98), rgba(218,236,218,0.96))',
    controlHoverText: '#2a4a22',
    controlActiveSurface: 'linear-gradient(180deg, rgba(218,236,218,0.98), rgba(200,224,200,0.96))',
    controlActiveText: '#1e3a18',
    panelSurface: 'linear-gradient(180deg, rgba(248,253,248,0.96), rgba(236,246,236,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(242,250,242,0.92), rgba(232,242,232,0.90))',
    panelBorder: 'rgba(60,90,48,0.12)',
    panelShadow: '0 16px 40px rgba(50,80,40,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(250,254,250,0.94), rgba(238,248,238,0.92))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(242,250,242,0.96), rgba(228,240,228,0.94))',
    cardBorder: 'rgba(60,90,48,0.11)',
    cardHoverBorder: 'rgba(74,136,56,0.22)',
    cardText: 'rgba(38,68,30,0.90)',
    cardMuted: 'rgba(42,74,34,0.50)',
    cardShadow: '0 18px 44px rgba(50,80,40,0.10)',
    cardHoverShadow: '0 26px 56px rgba(50,80,40,0.15)',
    filterSurface: 'rgba(74,136,56,0.10)',
    filterBorder: 'rgba(74,136,56,0.16)',
    filterText: 'rgba(56,100,40,0.82)',
    primarySurface: 'linear-gradient(135deg, #4a8838 0%, #2a4a22 100%)',
    primaryText: '#f0f8ee',
  },
  // 06 · Sakura 樱花 — cherry blossom pink, rose, mauve chrome
  sakura: {
    shellSurface: 'linear-gradient(165deg, rgba(255,248,252,0.98) 0%, rgba(252,236,246,0.96) 100%), radial-gradient(circle at 14% 12%, rgba(248,180,210,0.26) 0%, transparent 33%), radial-gradient(circle at 84% 16%, rgba(196,88,152,0.18) 0%, transparent 26%), radial-gradient(circle at 74% 84%, rgba(248,200,220,0.20) 0%, transparent 26%)',
    shellBorder: 'rgba(160,60,100,0.18)',
    shellShadow: '0 30px 90px rgba(140,40,90,0.12)',
    heading: '#5a1a30',
    summary: 'rgba(90,26,48,0.58)',
    muted: 'rgba(90,26,48,0.46)',
    controlSurface: 'linear-gradient(180deg, rgba(255,248,252,0.86), rgba(252,238,246,0.84))',
    controlBorder: 'rgba(160,60,100,0.14)',
    controlText: 'rgba(90,26,48,0.68)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(252,238,246,0.98), rgba(248,222,236,0.96))',
    controlHoverText: '#5a1a30',
    controlActiveSurface: 'linear-gradient(180deg, rgba(248,220,234,0.98), rgba(240,200,218,0.96))',
    controlActiveText: '#4a1228',
    panelSurface: 'linear-gradient(180deg, rgba(255,250,254,0.96), rgba(252,240,248,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(252,244,250,0.92), rgba(248,234,244,0.90))',
    panelBorder: 'rgba(160,60,100,0.12)',
    panelShadow: '0 16px 40px rgba(140,40,90,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(255,252,254,0.94), rgba(252,242,248,0.92))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(252,244,250,0.96), rgba(244,228,240,0.94))',
    cardBorder: 'rgba(160,60,100,0.10)',
    cardHoverBorder: 'rgba(232,116,138,0.28)',
    cardText: 'rgba(72,20,40,0.90)',
    cardMuted: 'rgba(90,26,48,0.50)',
    cardShadow: '0 18px 44px rgba(140,40,90,0.10)',
    cardHoverShadow: '0 26px 58px rgba(140,40,90,0.16)',
    filterSurface: 'rgba(232,116,138,0.12)',
    filterBorder: 'rgba(232,116,138,0.22)',
    filterText: 'rgba(160,60,90,0.82)',
    primarySurface: 'linear-gradient(135deg, #e85080 0%, #5a1a30 100%)',
    primaryText: '#fff8fc',
  },
  // 07 · Night 紫夜 — deep violet, indigo, twilight purple chrome
  night: {
    shellSurface: 'linear-gradient(165deg, rgba(244,240,255,0.98) 0%, rgba(232,224,252,0.96) 100%), radial-gradient(circle at 14% 12%, rgba(96,72,200,0.22) 0%, transparent 33%), radial-gradient(circle at 84% 16%, rgba(56,72,192,0.18) 0%, transparent 26%), radial-gradient(circle at 76% 84%, rgba(112,80,200,0.18) 0%, transparent 28%)',
    shellBorder: 'rgba(40,30,100,0.22)',
    shellShadow: '0 30px 90px rgba(40,30,120,0.14)',
    heading: '#1a1040',
    summary: 'rgba(26,16,64,0.58)',
    muted: 'rgba(26,16,64,0.46)',
    controlSurface: 'linear-gradient(180deg, rgba(248,244,255,0.88), rgba(236,228,252,0.86))',
    controlBorder: 'rgba(40,30,100,0.14)',
    controlText: 'rgba(26,16,64,0.68)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(236,228,255,0.98), rgba(220,212,252,0.96))',
    controlHoverText: '#1a1040',
    controlActiveSurface: 'linear-gradient(180deg, rgba(220,212,252,0.98), rgba(200,192,248,0.96))',
    controlActiveText: '#120a38',
    panelSurface: 'linear-gradient(180deg, rgba(250,248,255,0.96), rgba(236,228,252,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(244,240,255,0.92), rgba(228,220,248,0.90))',
    panelBorder: 'rgba(40,30,100,0.12)',
    panelShadow: '0 16px 40px rgba(40,30,120,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(252,250,255,0.94), rgba(238,230,252,0.92))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(244,240,255,0.96), rgba(228,220,248,0.94))',
    cardBorder: 'rgba(40,30,100,0.11)',
    cardHoverBorder: 'rgba(96,72,200,0.24)',
    cardText: 'rgba(22,12,52,0.90)',
    cardMuted: 'rgba(26,16,64,0.50)',
    cardShadow: '0 18px 44px rgba(40,30,120,0.10)',
    cardHoverShadow: '0 26px 58px rgba(40,30,120,0.16)',
    filterSurface: 'rgba(96,72,200,0.10)',
    filterBorder: 'rgba(96,72,200,0.18)',
    filterText: 'rgba(60,44,160,0.82)',
    primarySurface: 'linear-gradient(135deg, #6448c8 0%, #1a1040 100%)',
    primaryText: '#f0ecff',
  },
  // 08 · Dark 暗色 — dark board chrome, dark sticky notes with light ink
  dark: {
    shellSurface: 'linear-gradient(165deg, rgba(18,12,30,0.98) 0%, rgba(24,18,42,0.96) 100%), radial-gradient(circle at 14% 12%, rgba(100,70,180,0.28) 0%, transparent 33%), radial-gradient(circle at 84% 16%, rgba(70,90,180,0.22) 0%, transparent 28%), radial-gradient(circle at 76% 84%, rgba(80,60,150,0.20) 0%, transparent 28%)',
    shellBorder: 'rgba(100,80,180,0.28)',
    shellShadow: '0 30px 90px rgba(0,0,0,0.40)',
    heading: '#e4d8f8',
    summary: 'rgba(220,210,248,0.70)',
    muted: 'rgba(200,188,240,0.56)',
    controlSurface: 'linear-gradient(180deg, rgba(30,22,52,0.90), rgba(24,18,42,0.88))',
    controlBorder: 'rgba(100,80,180,0.22)',
    controlText: 'rgba(200,188,240,0.72)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(44,32,78,0.96), rgba(36,26,66,0.94))',
    controlHoverText: '#e4d8f8',
    controlActiveSurface: 'linear-gradient(180deg, rgba(58,44,100,0.98), rgba(48,36,86,0.96))',
    controlActiveText: '#f0ecff',
    panelSurface: 'linear-gradient(180deg, rgba(24,18,44,0.96), rgba(18,14,36,0.94))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(22,16,40,0.94), rgba(16,12,30,0.92))',
    panelBorder: 'rgba(100,80,180,0.20)',
    panelShadow: '0 16px 40px rgba(0,0,0,0.32)',
    cardSurface: 'linear-gradient(180deg, rgba(30,24,52,0.96), rgba(22,18,42,0.94))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(38,30,68,0.96), rgba(30,24,56,0.94))',
    cardBorder: 'rgba(100,80,180,0.18)',
    cardHoverBorder: 'rgba(130,100,220,0.32)',
    cardText: 'rgba(220,210,248,0.90)',
    cardMuted: 'rgba(180,165,220,0.60)',
    cardShadow: '0 18px 44px rgba(0,0,0,0.28)',
    cardHoverShadow: '0 26px 58px rgba(0,0,0,0.38)',
    filterSurface: 'rgba(100,80,180,0.14)',
    filterBorder: 'rgba(120,100,200,0.28)',
    filterText: 'rgba(180,165,230,0.90)',
    primarySurface: 'linear-gradient(135deg, #7060c0 0%, #2a1e5a 100%)',
    primaryText: '#f0ecff',
  },
}

function buildTheme(
  id: NoteColorThemeId,
  label: string,
  subtitle: string,
  icon: string,
): NoteColorThemeConfig {
  const slots = THEME_SLOTS[id]
  return {
    id,
    label,
    subtitle,
    icon,
    slots,
    colors: slots.map((s) => s.bg),
    shell: THEME_SHELL[id],
    chrome: THEME_CHROME[id],
  }
}

export const NOTE_COLOR_THEMES: readonly NoteColorThemeConfig[] = [
  buildTheme('classic', '默认', 'Classic', '🎨'),
  buildTheme('vivid',   '海蓝', 'Ocean',   '🌊'),
  buildTheme('cream',   '奶油', 'Harvest', '🌾'),
  buildTheme('mono',    '水墨', 'Newsroom','🖋'),
  buildTheme('dusk',    '日落', 'Sunset',  '🌅'),
  buildTheme('linen',   '森林', 'Forest',  '🌿'),
  buildTheme('sakura',  '樱花', 'Sakura',  '🌸'),
  buildTheme('night',   '紫夜', 'Night',   '🌙'),
  buildTheme('dark',    '暗色', 'Dark',    '🌑'),
]

// ── Context ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'note-color-theme'
const STORAGE_KEY_DARK = 'note-color-theme-dark'
const COOKIE_KEY = 'note-color-theme'

export { isValidNoteThemeId }
const DEFAULT_THEME = NOTE_COLOR_THEMES[0]

interface NoteColorThemeContextValue {
  theme: NoteColorThemeConfig
  setThemeId: (id: NoteColorThemeId) => void
}

const NoteColorThemeContext = createContext<NoteColorThemeContextValue>({
  theme: DEFAULT_THEME,
  setThemeId: () => {},
})

function isDarkMode(): boolean {
  try {
    return document.documentElement.classList.contains('dark')
  } catch {
    return false
  }
}

function getStoredThemeId(): NoteColorThemeId {
  try {
    const dark = isDarkMode()
    const key = dark ? STORAGE_KEY_DARK : STORAGE_KEY
    const stored = localStorage.getItem(key)
    if (isValidNoteThemeId(stored)) return stored
    return dark ? 'dark' : 'classic'
  } catch {}
  return 'classic'
}

function subscribeThemeChanges(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  // Watch .dark class toggles driven by next-themes
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => {
    window.removeEventListener('storage', callback)
    observer.disconnect()
  }
}

export function NoteColorThemeProvider({
  children,
  initialThemeId,
}: {
  children: ReactNode
  // Server-read cookie value — lets SSR render the correct theme from the start.
  initialThemeId?: NoteColorThemeId
}) {
  // Server snapshot uses the cookie value so the SSR HTML already carries the
  // correct CSS variable values. On the client, useSyncExternalStore re-reads
  // localStorage on every render, so the picker stays reactive.
  const themeId = useSyncExternalStore(
    subscribeThemeChanges,
    getStoredThemeId,
    () => initialThemeId ?? ('classic' as NoteColorThemeId),
  )

  // Keep the cookie in sync so future SSR renders use the latest effective theme.
  // This covers dark-mode toggles and first-visit localStorage→cookie migration.
  useEffect(() => {
    document.cookie = `${COOKIE_KEY}=${themeId}; path=/; max-age=31536000; SameSite=Lax`
  }, [themeId])

  const handleSetThemeId = (id: NoteColorThemeId) => {
    const key = isDarkMode() ? STORAGE_KEY_DARK : STORAGE_KEY
    localStorage.setItem(key, id)
    // Update cookie immediately (before the useEffect fires) so the next
    // navigation to this page already has the right value in the cookie.
    document.cookie = `${COOKIE_KEY}=${id}; path=/; max-age=31536000; SameSite=Lax`
    // Dispatch a synthetic storage event so the same-tab subscriber re-reads immediately
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: id }))
  }

  const theme = NOTE_COLOR_THEMES.find((t) => t.id === themeId) ?? DEFAULT_THEME

  return (
    <NoteColorThemeContext value={{ theme, setThemeId: handleSetThemeId }}>
      {children}
    </NoteColorThemeContext>
  )
}

export function useNoteColorTheme(): NoteColorThemeContextValue {
  return use(NoteColorThemeContext)
}
