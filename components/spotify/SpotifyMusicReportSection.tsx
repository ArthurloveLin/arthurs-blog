'use client'

import { useState, useTransition } from 'react'

import type { SpotifySectionCopy } from '@/lib/spotify-page-copy'
import type { MusicReport } from '@/lib/spotify-report'

import SpotifyMusicReportBoard from './SpotifyMusicReportBoard'

type Period = 'day' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  day: '日报',
  week: '周报',
  month: '月报',
}

export default function SpotifyMusicReportSection({
  copy,
  report,
}: {
  copy: SpotifySectionCopy
  report: MusicReport | null
}) {
  const [isPending, startTransition] = useTransition()
  const [activePeriod, setActivePeriod] = useState<Period>('week')

  function handlePeriodChange(period: Period) {
    if (period === activePeriod) return

    startTransition(() => {
      setActivePeriod(period)
    })
  }

  return (
    <section
      id="music-report"
      className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]"
    >
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{copy.eyebrow}</p>
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h3>
          <div className="inline-flex w-fit flex-nowrap gap-1 rounded-full border border-border/70 bg-background/80 p-0.5 flex-shrink-0">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  activePeriod === p
                    ? 'bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.12)]'
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
        {report ? (
          <SpotifyMusicReportBoard activePeriod={activePeriod} isTransitioning={isPending} report={report} />
        ) : (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-sm text-muted-foreground">
            Spotify report.json 暂未生成，当前页面不再回退到本地现场聚合。请等待 worker 下一次同步后再查看此区块。
          </div>
        )}
      </div>
    </section>
  )
}
