'use client'

import { useEffect, useState } from 'react'

import type { MusicReport, MusicReportStats } from '@/lib/spotify-report'

import SpotifyMusicReportPoster from './SpotifyMusicReportPoster'
import styles from './SpotifyMusicReportBoard.module.css'

const EMPTY_STATS = (period: 'day' | 'week' | 'month'): MusicReportStats => ({
  period,
  periodLabel: period === 'day' ? '今天' : period === 'week' ? '本周' : '本月',
  dateRange: '—',
  topTrack: null,
  topArtist: null,
  topContext: null,
  topTag: null,
  totalPlays: 0,
  totalMinutes: 0,
  peakHour: null,
})

export default function SpotifyMusicReportBoard() {
  const [report, setReport] = useState<MusicReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

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

  const day = report?.day ?? EMPTY_STATS('day')
  const week = report?.week ?? EMPTY_STATS('week')
  const month = report?.month ?? EMPTY_STATS('month')

  if (hasError) {
    return (
      <div className={styles.board}>
        <span className={styles.boardTitle}>MUSIC REPORT</span>
        <p style={{ textAlign: 'center', color: 'rgba(40,25,8,0.4)', fontSize: '0.8rem', padding: '2rem 0' }}>
          暂时无法加载报告数据
        </p>
      </div>
    )
  }

  return (
    <div className={styles.board}>
      <span className={styles.boardTitle}>MUSIC REPORT</span>

      <div className={styles.posters}>
        {/* 日报 — smallest, left */}
        <SpotifyMusicReportPoster stats={day} isLoading={isLoading} />

        {/* 周报 — medium, center */}
        <SpotifyMusicReportPoster stats={week} isLoading={isLoading} />

        {/* 月报 — largest, right */}
        <SpotifyMusicReportPoster stats={month} isLoading={isLoading} />
      </div>
    </div>
  )
}
