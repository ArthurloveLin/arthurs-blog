'use client'

import type { CSSProperties } from 'react'
import type { MusicReportStats } from '@/lib/spotify-report'
import styles from './TopTrackPoster.module.css'

interface Props {
  stats: MusicReportStats
  isLoading?: boolean
  isTransitioning?: boolean
}

export default function TopTrackPoster({ stats, isLoading, isTransitioning }: Props) {
  const track = stats.topTrack

  return (
    <div
      className={`${styles.poster} ${isTransitioning ? styles.transitioning : ''}`}
    >
      {/* Accent bar */}
      <div className={styles.accentBar} />

      {/* Hero cover area — 58% */}
      <div className={styles.coverArea}>
        {isLoading ? (
          <div className={styles.coverSkeleton} />
        ) : track?.albumImageUrl ? (
          <img
            className={styles.coverImg}
            src={track.albumImageUrl}
            alt={track.title}
            width={158}
            height={92}
          />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
        <div className={styles.coverGradient} />
        {track && track.playCount > 1 && !isLoading && (
          <span className={styles.playBadge}>×{track.playCount}</span>
        )}
      </div>

      {/* Info area */}
      <div className={styles.infoArea}>
        <span className={styles.eyebrow}>TOP TRACK</span>
        {isLoading ? (
          <>
            <div className={styles.skeleton} style={{ height: '14px', width: '90%', marginTop: '0.3rem' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '10px', width: '65%', marginTop: '0.3rem' } as CSSProperties} />
          </>
        ) : track ? (
          <>
            <h3 className={styles.trackTitle}>{track.title}</h3>
            <p className={styles.artistName}>{track.artist}</p>
          </>
        ) : (
          <div className={styles.emptyLabel}>今{stats.period === 'day' ? '日' : stats.period === 'week' ? '周' : '月'}暂无数据</div>
        )}
        <div className={styles.footer}>
          <span className={styles.footerMeta}>{stats.dateRange}</span>
        </div>
      </div>
    </div>
  )
}
