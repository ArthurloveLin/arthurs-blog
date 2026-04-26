'use client'

import { useCallback, useEffect, useState } from 'react'

import type { MusicReport, MusicReportStats } from '@/lib/spotify-report'
import PosterShell from './PosterShell'
import TopTrackPoster from './posters/TopTrackPoster'
import TopArtistPoster from './posters/TopArtistPoster'
import StatsInsightPoster from './posters/StatsInsightPoster'
import VibePoster from './posters/VibePoster'
import styles from './SpotifyMusicReportBoard.module.css'

type Period = 'day' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  day: '今天',
  week: '本周',
  month: '本月',
}

const EMPTY_STATS = (period: Period): MusicReportStats => ({
  period,
  periodLabel: PERIOD_LABELS[period],
  dateRange: '—',
  topTrack: null,
  topArtist: null,
  top5Tracks: [],
  top5Artists: [],
  topContext: null,
  topTag: null,
  totalPlays: 0,
  totalMinutes: 0,
  peakHour: null,
})

const POSTER_CONFIGS = [
  { rotation: -3,   pinColor: '#c0392b', tapeRotation: -2   },
  { rotation: 1.5,  pinColor: '#1a5c35', tapeRotation: 1.2  },
  { rotation: -1.8, pinColor: '#263694', tapeRotation: -1   },
  { rotation: 2.8,  pinColor: '#6b1a6b', tapeRotation: 2    },
] as const

export default function SpotifyMusicReportBoard() {
  const [report, setReport] = useState<MusicReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [activePeriod, setActivePeriod] = useState<Period>('week')
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setHasError(false)
      try {
        const res = await fetch('/api/spotify/report', { cache: 'no-store' })
        if (!res.ok) throw new Error(`${res.status}`)
        const data = (await res.json()) as MusicReport
        if (!cancelled) setReport(data)
      } catch {
        if (!cancelled) setHasError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const handlePeriodChange = useCallback((period: Period) => {
    if (period === activePeriod) return
    setIsTransitioning(true)
    setTimeout(() => {
      setActivePeriod(period)
      setIsTransitioning(false)
    }, 200)
  }, [activePeriod])

  const stats = report?.[activePeriod] ?? EMPTY_STATS(activePeriod)

  if (hasError) {
    return (
      <div className={styles.board}>
        <div className={styles.boardHeader}>
          <span className={styles.boardTitle}>MUSIC REPORT</span>
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(40,25,8,0.4)', fontSize: '0.8rem', padding: '2rem 0' }}>
          暂时无法加载报告数据
        </p>
      </div>
    )
  }

  return (
    <div className={styles.board}>
      {/* Board header with title + period switcher */}
      <div className={styles.boardHeader}>
        <span className={styles.boardTitle}>MUSIC REPORT</span>

        <div className={styles.periodSwitcher}>
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              className={`${styles.periodBtn} ${activePeriod === p ? styles.periodBtnActive : ''}`}
              onClick={() => handlePeriodChange(p)}
              type="button"
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 4 content-dimension posters */}
      <div className={styles.posters}>
        <PosterShell rotation={POSTER_CONFIGS[0].rotation} pinColor={POSTER_CONFIGS[0].pinColor} tapeRotation={POSTER_CONFIGS[0].tapeRotation}>
          <TopTrackPoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>

        <PosterShell rotation={POSTER_CONFIGS[1].rotation} pinColor={POSTER_CONFIGS[1].pinColor} tapeRotation={POSTER_CONFIGS[1].tapeRotation}>
          <TopArtistPoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>

        <PosterShell rotation={POSTER_CONFIGS[2].rotation} pinColor={POSTER_CONFIGS[2].pinColor} tapeRotation={POSTER_CONFIGS[2].tapeRotation}>
          <StatsInsightPoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>

        <PosterShell rotation={POSTER_CONFIGS[3].rotation} pinColor={POSTER_CONFIGS[3].pinColor} tapeRotation={POSTER_CONFIGS[3].tapeRotation}>
          <VibePoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>
      </div>
    </div>
  )
}
