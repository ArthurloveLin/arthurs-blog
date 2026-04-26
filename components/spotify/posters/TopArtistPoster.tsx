'use client'

import type { CSSProperties } from 'react'
import type { MusicReportStats } from '@/lib/spotify-report'
import styles from './TopArtistPoster.module.css'

interface Props {
  stats: MusicReportStats
  isLoading?: boolean
  isTransitioning?: boolean
}

export default function TopArtistPoster({ stats, isLoading, isTransitioning }: Props) {
  const artist = stats.topArtist
  const albumImageUrl = stats.topTrack?.albumImageUrl ?? null

  return (
    <div className={`${styles.poster} ${isTransitioning ? styles.transitioning : ''}`}>
      {/* Blurred background from album art */}
      {albumImageUrl && !isLoading && (
        <div
          className={styles.blurBg}
          style={{ backgroundImage: `url(${albumImageUrl})` } as CSSProperties}
        />
      )}
      <div className={styles.overlay} />

      {/* Accent bar */}
      <div className={styles.accentBar} />

      <div className={styles.content}>
        <span className={styles.eyebrow}>TOP ARTIST</span>

        {isLoading ? (
          <>
            <div className={styles.skeleton} style={{ height: '32px', width: '85%', marginTop: '0.8rem' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '10px', width: '50%', marginTop: '0.5rem' } as CSSProperties} />
          </>
        ) : artist ? (
          <>
            <h2 className={styles.artistName}>{artist.name}</h2>
            <span className={styles.playsCount}>{artist.playCount} plays</span>
            {stats.topTag && (
              <span className={styles.genreTag}>{stats.topTag}</span>
            )}
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
