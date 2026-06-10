// Shared sidebar primitives: mode switcher, tag chip palette, calendar cell math.
'use client'

import { Activity, CalendarDays, History } from 'lucide-react'
import type {} from '@/lib/memo-habits'
import type {} from '@/lib/note-boards'

export function hexToRgb(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}

export type SidebarModeKey = 'agenda' | 'heatmap' | 'history'
export const SIDEBAR_MODE_ICONS: Record<SidebarModeKey, React.ReactNode> = {
  agenda: <CalendarDays size={13} />,
  heatmap: <Activity size={13} />,
  history: <History size={13} />,
}

export interface SidebarModeEntry {
  key: SidebarModeKey
  label: string
}

export interface SidebarModeControlProps {
  sidebarModes: readonly SidebarModeEntry[]
  calendarMode: SidebarModeKey
  onCalendarModeChange: (mode: SidebarModeKey) => void
}

export function SidebarModeButtons({ sidebarModes, calendarMode, onCalendarModeChange }: SidebarModeControlProps) {
  return (
    <div className="flex items-center gap-0.5">
      {sidebarModes.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => onCalendarModeChange(mode.key)}
          title={mode.label}
          aria-label={mode.label}
          className={[
            'rounded-full p-1.5 transition',
            calendarMode === mode.key
              ? '[background:var(--memo-control-active-surface)] text-[color:var(--memo-control-active-text)]'
              : 'text-[color:var(--memo-control-text)] hover:[background:var(--memo-control-hover-surface)] hover:text-[color:var(--memo-control-hover-text)]',
          ].join(' ')}
        >
          {SIDEBAR_MODE_ICONS[mode.key]}
        </button>
      ))}
    </div>
  )
}

export const CHIP_COLORS = [
  '#c0644a', '#7a5ae0', '#1f8a5b',
  '#2a6fdb', '#b2841f', '#a14d8b', '#4a8c7a',
]

export function getTagColor(tagName: string): string {
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = (hash + tagName.charCodeAt(i)) % CHIP_COLORS.length
  }
  return CHIP_COLORS[hash] ?? CHIP_COLORS[0]!
}


export function formatShanghaTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}


export function buildCalendarCells(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()
  const startPad = (firstDow + 6) % 7

  const cells: Array<{ day: number; kind: 'prev' | 'current' | 'next' }> = []

  for (let i = startPad - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, kind: 'prev' })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, kind: 'current' })
  }
  const remaining = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, kind: 'next' })
  }

  return cells
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
