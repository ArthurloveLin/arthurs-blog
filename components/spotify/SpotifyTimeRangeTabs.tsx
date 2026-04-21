'use client'

import type { SpotifyTimeRange } from '@/lib/spotify-types'

const RANGE_LABELS: Record<SpotifyTimeRange, string> = {
  short_term: '近 4 周',
  medium_term: '近 6 个月',
  long_term: '历史全部',
}

const ACTIVE_CLASS_NAMES: Record<'emerald' | 'contrast', string> = {
  emerald: 'bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]',
  contrast: 'bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.12)]',
}

export default function SpotifyTimeRangeTabs({
  activeRange,
  onChange,
  tone,
}: {
  activeRange: SpotifyTimeRange
  onChange: (range: SpotifyTimeRange) => void
  tone: 'emerald' | 'contrast'
}) {
  return (
    <div className="inline-flex flex-nowrap gap-1 overflow-x-auto scrollbar-none rounded-full border border-border/70 bg-background/80 p-0.5">
      {(Object.keys(RANGE_LABELS) as SpotifyTimeRange[]).map((range) => {
        const isActive = range === activeRange

        return (
          <button
            key={range}
            type="button"
            onClick={() => onChange(range)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              isActive
                ? ACTIVE_CLASS_NAMES[tone]
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {RANGE_LABELS[range]}
          </button>
        )
      })}
    </div>
  )
}