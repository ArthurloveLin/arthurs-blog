'use client'

import { useCallback, useState } from 'react'

import type { SpotifySectionCopy } from '@/lib/spotify-page-copy'

import SpotifyMusicReportBoard from './SpotifyMusicReportBoard'

type Period = 'day' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  day: '日报',
  week: '周报',
  month: '月报',
}

export default function SpotifyMusicReportSection({ copy }: { copy: SpotifySectionCopy }) {
  const [activePeriod, setActivePeriod] = useState<Period>('week')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handlePeriodChange = useCallback((period: Period) => {
    if (period === activePeriod) return
    setIsTransitioning(true)
    setTimeout(() => {
      setActivePeriod(period)
      setIsTransitioning(false)
    }, 200)
  }, [activePeriod])

  return (
    <section
      id="music-report"
      className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60_rgba(0,0,0,0.05)]"
    >
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{copy.eyebrow}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h3>
          <div className="inline-flex flex-nowrap gap-0.5 rounded-full border border-border/50 bg-muted/60 p-0.5 flex-shrink-0">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  activePeriod === p
                    ? 'bg-foreground/90 text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>

      <div className="mt-6">
        <SpotifyMusicReportBoard activePeriod={activePeriod} isTransitioning={isTransitioning} />
      </div>
    </section>
  )
}
