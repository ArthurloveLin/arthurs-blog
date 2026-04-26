'use client'

import type { CSSProperties } from 'react'
import type { MusicReportStats } from '@/lib/spotify-report'
import styles from './TopTrackPoster.module.css'

interface Props {
  stats: MusicReportStats
  isLoading?: boolean
  isTransitioning?: boolean
}

function formatDuration(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TopTrackPoster({ stats, isLoading, isTransitioning }: Props) {
  const track = stats.topTrack

  return (
    <div className={`${styles.poster} ${isTransitioning ? styles.transitioning : ''}`}>
      <div className={styles.accentBar} />

      {/* Hero cover — 55% */}
      <div className={styles.coverArea}>
        {isLoading ? (
          <div className={styles.coverSkeleton} />
        ) : track?.albumImageUrl ? (
          <img className={styles.coverImg} src={track.albumImageUrl} alt={track.title} width={195} height={107} />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
        <div className={styles.coverGradient} />
        {track && track.playCount > 1 && !isLoading && (
          <span className={styles.playBadge}>×{track.playCount}</span>
        )}
        {!isLoading && (
          <span className={styles.coverLabel}>TOP TRACK</span>
        )}
      </div>

      {/* Info area — 45% */}
      <div className={styles.infoArea}>
        {isLoading ? (
          <>
            <div className={styles.skeleton} style={{ height: '14px', width: '90%' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '10px', width: '65%', marginTop: '0.35rem' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '10px', width: '50%', marginTop: '0.8rem' } as CSSProperties} />
          </>
        ) : track ? (
          <>
            <h3 className={styles.trackTitle}>{track.title}</h3>
            <p className={styles.artistName}>{track.artist}</p>

            <div className={styles.divider} />

            <div className={styles.metaRow}>
              {track.durationMs > 0 && (
                <span className={styles.metaChip}>{formatDuration(track.durationMs)}</span>
              )}
              {stats.topTag && (
                <span className={styles.metaChip}>{stats.topTag}</span>
              )}
            </div>

            <div className={styles.statRow}>
              <span className={styles.statItem}>
                ×<span className={styles.statNum}>{track.playCount}</span> 次
              </span>
              {track.durationMs > 0 && (
                <span className={styles.statItem}>
                  <span className={styles.statNum}>{Math.round(track.playCount * track.durationMs / 60000)}</span>min
                </span>
              )}
              {stats.peakHour !== null && (
                <span className={styles.statItem}>
                  峰值 <span className={styles.statNum}>{String(stats.peakHour).padStart(2,'0')}:00</span>
                </span>
              )}
            </div>
          </>
        ) : (
          <div className={styles.emptyLabel}>今{stats.period === 'day' ? '日' : stats.period === 'week' ? '周' : '月'}暂无数据</div>
        )}
      </div>
    </div>
  )
}
