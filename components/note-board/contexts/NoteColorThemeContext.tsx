'use client'

import { createContext, use, useSyncExternalStore, type ReactNode } from 'react'

export type NoteColorThemeId = 'classic' | 'vivid' | 'cream' | 'mono' | 'dusk' | 'linen'

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

const VALID_IDS = new Set<NoteColorThemeId>(['classic', 'vivid', 'cream', 'mono', 'dusk', 'linen'])

// ── Theme data ────────────────────────────────────────────────────────────────

const THEME_SLOTS: Record<NoteColorThemeId, readonly NoteColorSlot[]> = {
  // 00 · Classic 默认 — high-saturation macaroon, original first impression
  classic: [
    { bg: '#fbd9d3', bg2: '#f4c0b6', ink: '#5a2820', tape: '#f29a87' }, // rose
    { bg: '#fbe9a0', bg2: '#f3d878', ink: '#5a4818', tape: '#d6b045' }, // butter
    { bg: '#bfe4cf', bg2: '#9bd1b1', ink: '#1f4a35', tape: '#7fb495' }, // mint
    { bg: '#c8def0', bg2: '#a8c8e2', ink: '#1d3f5a', tape: '#85a6c6' }, // sky
    { bg: '#e5d0e8', bg2: '#cfb4d4', ink: '#412447', tape: '#b388ba' }, // lilac
    { bg: '#d8caea', bg2: '#bfacdc', ink: '#322050', tape: '#a288c8' }, // lavender
    { bg: '#d6dbb8', bg2: '#bdc395', ink: '#3a4220', tape: '#9aa57a' }, // sage
  ],

  // 01 · Vivid 明亮 — balanced high-chroma, warm/cool split
  vivid: [
    { bg: '#f6d7cf', bg2: '#edbaad', ink: '#512f28', tape: '#e76f51' },
    { bg: '#f7e2b2', bg2: '#ebcd82', ink: '#544120', tape: '#e9c46a' },
    { bg: '#cde7da', bg2: '#aed8c8', ink: '#1f4a44', tape: '#2a9d8f' },
    { bg: '#d3e2f1', bg2: '#b6cbe0', ink: '#21465a', tape: '#457b9d' },
    { bg: '#e0d7f0', bg2: '#cbbde6', ink: '#453260', tape: '#7b6ed6' },
    { bg: '#efd8e7', bg2: '#ddc0d3', ink: '#5b3451', tape: '#b565a7' },
    { bg: '#dde5be', bg2: '#c9d395', ink: '#3d491f', tape: '#8aa145' },
  ],

  // 02 · Cream 奶油 — refined natural paper, based on soft earth neutrals
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

  // 04 · Dusk 黄昏 — editorial terracotta, olive, indigo, cream
  dusk: [
    { bg: '#ebc9bc', bg2: '#dda691', ink: '#4b2c25', tape: '#b85b35' },
    { bg: '#f0e0bf', bg2: '#e1c793', ink: '#554223', tape: '#dda15e' },
    { bg: '#d6dac8', bg2: '#b9c0a4', ink: '#38412e', tape: '#5a5e4b' },
    { bg: '#d5dbe6', bg2: '#b4c0d3', ink: '#263248', tape: '#59708c' },
    { bg: '#dccddd', bg2: '#c1aec6', ink: '#4a314b', tape: '#8e6c88' },
    { bg: '#c8d0de', bg2: '#aab6c8', ink: '#1e2433', tape: '#44506b' },
    { bg: '#e0d2ba', bg2: '#cbb48d', ink: '#4d3c25', tape: '#a47644' },
  ],

  // 05 · Linen 亚麻 — field notes palette, olive garden and bark tones
  linen: [
    { bg: '#f7f1e3', bg2: '#efe6d4', ink: '#8c5a3c', tape: '#bc6c25' },
    { bg: '#f6f1e1', bg2: '#ece2c8', ink: '#7b632d', tape: '#dda15e' },
    { bg: '#f2f0db', bg2: '#e3e3c0', ink: '#5c6730', tape: '#8a9a5b' },
    { bg: '#eef1e3', bg2: '#dce5c7', ink: '#4a5a36', tape: '#606c38' },
    { bg: '#ecefde', bg2: '#d9dfc8', ink: '#354226', tape: '#283618' },
    { bg: '#eef0ea', bg2: '#d6ddd7', ink: '#49555a', tape: '#7d8d90' },
    { bg: '#efe8e2', bg2: '#dbd0c7', ink: '#6a4b45', tape: '#a06d5d' },
  ],
}

const THEME_SHELL: Record<NoteColorThemeId, readonly [string, string]> = {
  classic: ['#f8d878', '#c8b0f8'], // butter gold top-left · lavender bottom-right
  vivid: ['#e9c46a', '#2a9d8f'],
  cream: ['#d4a373', '#ccd5ae'],
  mono: ['#b2a69a', '#8b98a0'],
  dusk: ['#b85b35', '#1e2433'],
  linen: ['#606c38', '#bc6c25'],
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
    panelSurface: 'linear-gradient(180deg, rgba(255,254,252,0.60), rgba(249,246,240,0.50))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(252,250,246,0.44), rgba(244,240,234,0.34))',
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
    shellSurface: 'linear-gradient(165deg, rgba(255,252,246,0.98) 0%, rgba(247,245,236,0.96) 100%), radial-gradient(circle at 14% 12%, rgba(233,196,106,0.26) 0%, transparent 33%), radial-gradient(circle at 84% 16%, rgba(231,111,81,0.18) 0%, transparent 26%), radial-gradient(circle at 76% 84%, rgba(42,157,143,0.22) 0%, transparent 28%)',
    shellBorder: 'rgba(61,103,103,0.22)',
    shellShadow: '0 30px 90px rgba(53,93,99,0.14)',
    heading: '#264653',
    summary: 'rgba(38,70,83,0.58)',
    muted: 'rgba(38,70,83,0.46)',
    controlSurface: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(244,241,232,0.84))',
    controlBorder: 'rgba(38,70,83,0.14)',
    controlText: 'rgba(38,70,83,0.68)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(247,243,232,0.98), rgba(240,232,209,0.96))',
    controlHoverText: '#264653',
    controlActiveSurface: 'linear-gradient(180deg, rgba(239,228,204,0.98), rgba(231,212,179,0.96))',
    controlActiveText: '#1f3f4b',
    panelSurface: 'linear-gradient(180deg, rgba(255,255,255,0.58), rgba(246,243,235,0.48))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(250,248,242,0.42), rgba(242,239,232,0.34))',
    panelBorder: 'rgba(38,70,83,0.12)',
    panelShadow: '0 16px 40px rgba(53,93,99,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,244,236,0.90))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(247,244,236,0.96), rgba(237,230,214,0.94))',
    cardBorder: 'rgba(38,70,83,0.11)',
    cardHoverBorder: 'rgba(42,157,143,0.22)',
    cardText: 'rgba(36,63,74,0.90)',
    cardMuted: 'rgba(38,70,83,0.50)',
    cardShadow: '0 18px 44px rgba(49,86,90,0.10)',
    cardHoverShadow: '0 26px 58px rgba(49,86,90,0.16)',
    filterSurface: 'rgba(231,111,81,0.10)',
    filterBorder: 'rgba(231,111,81,0.18)',
    filterText: 'rgba(188,84,57,0.82)',
    primarySurface: 'linear-gradient(135deg, #2a9d8f 0%, #264653 100%)',
    primaryText: '#fff8ef',
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
    panelSurface: 'linear-gradient(180deg, rgba(255,252,246,0.58), rgba(245,239,229,0.48))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(250,247,240,0.42), rgba(242,237,228,0.34))',
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
    panelSurface: 'linear-gradient(180deg, rgba(255,255,255,0.46), rgba(241,238,233,0.42))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(248,246,243,0.44), rgba(238,235,229,0.34))',
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
    shellSurface: 'linear-gradient(180deg, rgba(248,242,235,0.97) 0%, rgba(236,229,220,0.95) 100%), radial-gradient(circle at 14% 12%, rgba(184,91,53,0.24) 0%, transparent 30%), radial-gradient(circle at 86% 16%, rgba(30,36,51,0.22) 0%, transparent 28%), radial-gradient(circle at 72% 84%, rgba(90,94,75,0.18) 0%, transparent 24%)',
    shellBorder: 'rgba(74,82,92,0.26)',
    shellShadow: '0 30px 92px rgba(53,61,74,0.16)',
    heading: '#1e2433',
    summary: 'rgba(30,36,51,0.58)',
    muted: 'rgba(30,36,51,0.46)',
    controlSurface: 'linear-gradient(180deg, rgba(252,247,242,0.84), rgba(239,232,224,0.82))',
    controlBorder: 'rgba(30,36,51,0.14)',
    controlText: 'rgba(30,36,51,0.64)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(242,233,223,0.98), rgba(233,220,204,0.96))',
    controlHoverText: '#1e2433',
    controlActiveSurface: 'linear-gradient(180deg, rgba(234,222,213,0.98), rgba(222,208,191,0.96))',
    controlActiveText: '#1a2030',
    panelSurface: 'linear-gradient(180deg, rgba(255,250,245,0.50), rgba(241,234,227,0.44))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(247,241,236,0.42), rgba(236,230,223,0.34))',
    panelBorder: 'rgba(30,36,51,0.11)',
    panelShadow: '0 16px 40px rgba(53,61,74,0.10)',
    cardSurface: 'linear-gradient(180deg, rgba(255,251,247,0.90), rgba(242,235,228,0.88))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(247,241,235,0.96), rgba(234,225,216,0.94))',
    cardBorder: 'rgba(30,36,51,0.12)',
    cardHoverBorder: 'rgba(184,91,53,0.22)',
    cardText: 'rgba(31,37,50,0.90)',
    cardMuted: 'rgba(30,36,51,0.50)',
    cardShadow: '0 18px 44px rgba(53,61,74,0.12)',
    cardHoverShadow: '0 28px 58px rgba(53,61,74,0.18)',
    filterSurface: 'rgba(184,91,53,0.10)',
    filterBorder: 'rgba(184,91,53,0.18)',
    filterText: 'rgba(146,79,48,0.82)',
    primarySurface: 'linear-gradient(135deg, #1e2433 0%, #44506b 100%)',
    primaryText: '#f7f2ea',
  },
  linen: {
    shellSurface: 'linear-gradient(180deg, rgba(248,244,233,0.97) 0%, rgba(239,234,220,0.95) 100%), radial-gradient(circle at 15% 15%, rgba(96,108,56,0.20) 0%, transparent 32%), radial-gradient(circle at 87% 14%, rgba(188,108,37,0.18) 0%, transparent 28%), repeating-linear-gradient(90deg, rgba(72,79,48,0.04) 0 1px, transparent 1px 22px)',
    shellBorder: 'rgba(99,102,71,0.23)',
    shellShadow: '0 30px 88px rgba(89,92,66,0.12)',
    heading: '#344225',
    summary: 'rgba(52,66,37,0.56)',
    muted: 'rgba(52,66,37,0.44)',
    controlSurface: 'linear-gradient(180deg, rgba(250,247,238,0.86), rgba(240,236,225,0.82))',
    controlBorder: 'rgba(99,102,71,0.16)',
    controlText: 'rgba(52,66,37,0.62)',
    controlHoverSurface: 'linear-gradient(180deg, rgba(242,238,226,0.98), rgba(229,224,205,0.96))',
    controlHoverText: '#344225',
    controlActiveSurface: 'linear-gradient(180deg, rgba(231,227,211,0.98), rgba(217,212,188,0.96))',
    controlActiveText: '#2f3c21',
    panelSurface: 'linear-gradient(180deg, rgba(252,249,242,0.50), rgba(241,236,226,0.44))',
    panelMutedSurface: 'linear-gradient(180deg, rgba(246,243,237,0.42), rgba(236,232,223,0.34))',
    panelBorder: 'rgba(99,102,71,0.12)',
    panelShadow: '0 16px 40px rgba(89,92,66,0.08)',
    cardSurface: 'linear-gradient(180deg, rgba(252,249,242,0.92), rgba(241,236,226,0.90))',
    cardEditingSurface: 'linear-gradient(180deg, rgba(246,242,234,0.96), rgba(233,227,214,0.94))',
    cardBorder: 'rgba(99,102,71,0.11)',
    cardHoverBorder: 'rgba(96,108,56,0.22)',
    cardText: 'rgba(50,63,36,0.90)',
    cardMuted: 'rgba(52,66,37,0.50)',
    cardShadow: '0 18px 44px rgba(89,92,66,0.10)',
    cardHoverShadow: '0 26px 56px rgba(89,92,66,0.15)',
    filterSurface: 'rgba(96,108,56,0.10)',
    filterBorder: 'rgba(96,108,56,0.16)',
    filterText: 'rgba(73,84,38,0.82)',
    primarySurface: 'linear-gradient(135deg, #606c38 0%, #283618 100%)',
    primaryText: '#f9f7ef',
  },
}

function buildTheme(
  id: NoteColorThemeId,
  label: string,
  subtitle: string,
): NoteColorThemeConfig {
  const slots = THEME_SLOTS[id]
  return {
    id,
    label,
    subtitle,
    slots,
    colors: slots.map((s) => s.bg),
    shell: THEME_SHELL[id],
    chrome: THEME_CHROME[id],
  }
}

export const NOTE_COLOR_THEMES: readonly NoteColorThemeConfig[] = [
  buildTheme('classic', '默认', 'Classic'),
  buildTheme('vivid', '明亮', 'Riviera'),
  buildTheme('cream', '奶油', 'Harvest'),
  buildTheme('mono', '低饱和', 'Newsroom'),
  buildTheme('dusk', '黄昏', 'Terracotta Ink'),
  buildTheme('linen', '亚麻', 'Field Notes'),
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
  return 'classic'
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
    () => 'classic' as NoteColorThemeId,
  )

  const handleSetThemeId = (id: NoteColorThemeId) => {
    localStorage.setItem(STORAGE_KEY, id)
    // Dispatch a synthetic storage event so the same-tab subscriber re-reads immediately
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: id }))
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
