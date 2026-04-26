'use client'

import type { CSSProperties } from 'react'
import type { MusicReportStats } from '@/lib/spotify-report'
import styles from './StatsInsightPoster.module.css'

interface Props {
  stats: MusicReportStats
  isLoading?: boolean
  isTransitioning?: boolean
}

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

export default function StatsInsightPoster({ stats, isLoading, isTransitioning }: Props) {
  const { top5Tracks, top5Artists, totalMinutes, peakHour, topTag, dateRange, period } = stats
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  // Pick up to 4 unique album images for the collage
  const collageImages: (string | null)[] = []
  for (const t of top5Tracks) {
    if (collageImages.length >= 4) break
    if (t.albumImageUrl && !collageImages.includes(t.albumImageUrl)) {
      collageImages.push(t.albumImageUrl)
    }
  }
  while (collageImages.length < 4) collageImages.push(null)

  const isEmpty = stats.totalPlays === 0

  return (
    <div className={`${styles.poster} ${isTransitioning ? styles.transitioning : ''}`}>
      {/* Accent bar */}
      <div className={styles.accentBar} />

      {/* ── Hero area 30% ── */}
      <div className={styles.heroArea}>
        {isLoading ? (
          <div className={styles.heroSkeleton} />
        ) : (
          <>
            <div className={styles.collageGrid}>
              {collageImages.map((url, i) =>
                url ? (
                  <img key={i} src={url} className={styles.collageImg} alt="" width={79} height={37} />
                ) : (
                  <div key={i} className={styles.collagePlaceholder} />
                )
              )}
            </div>
            {/* Date label along left edge */}
            <span className={styles.dateEdge}>{dateRange}</span>
            <div className={styles.heroGradient} />
          </>
        )}
      </div>

      {/* ── Ranked list area 50% ── */}
      <div className={styles.listsArea}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.6rem 0.7rem' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.skeleton} style={{ height: '10px', width: `${85 - i * 8}%` } as CSSProperties} />
            ))}
          </div>
        ) : isEmpty ? (
          <div className={styles.emptyState}>
            <div className={styles.restStamp}>REST</div>
            <span className={styles.emptyLabel}>今{period === 'day' ? '日' : period === 'week' ? '周' : '月'}无演出</span>
          </div>
        ) : (
          <div className={styles.twoColumns}>
            {/* Left: Top 5 Artists */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>歌手</div>
              {top5Artists.slice(0, 5).map((a, i) => (
                <div key={a.name} className={styles.rankRow}>
                  <span className={styles.rankNum}>{i + 1}</span>
                  <span className={styles.rankName}>{a.name}</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 5 - top5Artists.length) }).map((_, i) => (
                <div key={`empty-a-${i}`} className={styles.rankRow}>
                  <span className={styles.rankNum}>{top5Artists.length + i + 1}</span>
                  <span className={styles.rankNameEmpty}>—</span>
                </div>
              ))}
            </div>

            <div className={styles.columnDivider} />

            {/* Right: Top 5 Tracks */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>单曲</div>
              {top5Tracks.slice(0, 5).map((t, i) => (
                <div key={`${t.title}-${i}`} className={styles.rankRow}>
                  <span className={styles.rankNum}>{i + 1}</span>
                  <span className={styles.rankName}>{t.title}</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 5 - top5Tracks.length) }).map((_, i) => (
                <div key={`empty-t-${i}`} className={styles.rankRow}>
                  <span className={styles.rankNum}>{top5Tracks.length + i + 1}</span>
                  <span className={styles.rankNameEmpty}>—</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom stats 20% ── */}
      <div className={styles.bottomArea}>
        <div className={styles.divider} />
        <div className={styles.statsRow}>
          <span className={styles.statItem}>
            {isLoading ? (
              <span className={styles.skeleton} style={{ display: 'inline-block', width: '48px', height: '10px' } as CSSProperties} />
            ) : (
              <><span className={styles.statNum}>{hours > 0 ? `${hours}h ` : ''}{mins}min</span></>
            )}
          </span>
          {topTag && !isLoading && (
            <span className={styles.vibeTag}>{topTag}</span>
          )}
          {peakHour !== null && !isLoading && (
            <span className={styles.statItem}>
              peak <span className={styles.statNum}>{formatHour(peakHour)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
