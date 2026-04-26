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
  const artistImageUrl = artist?.imageUrl ?? null
  // fallback: use album art blurred if no artist image
  const fallbackImageUrl = stats.topTrack?.albumImageUrl ?? null
  const bgImageUrl = artistImageUrl ?? fallbackImageUrl

  return (
    <div className={`${styles.poster} ${isTransitioning ? styles.transitioning : ''}`}>
      {/* Background: artist photo or blurred album art */}
      {bgImageUrl && !isLoading && (
        <div
          className={`${styles.bgImage} ${!artistImageUrl ? styles.bgBlur : ''}`}
          style={{ backgroundImage: `url(${bgImageUrl})` } as CSSProperties}
        />
      )}
      <div className={`${styles.overlay} ${!bgImageUrl ? styles.overlayDark : ''}`} />

      <div className={styles.accentBar} />

      {/* Artist cover image (50%) — shown prominently when available */}
      <div className={styles.coverArea}>
        {isLoading ? (
          <div className={styles.coverSkeleton} />
        ) : artistImageUrl ? (
          <img className={styles.coverImg} src={artistImageUrl} alt={artist?.name ?? ''} width={195} height={98} />
        ) : fallbackImageUrl ? (
          <img
            className={styles.coverImg}
            src={fallbackImageUrl}
            alt=""
            width={195}
            height={98}
            style={{ filter: 'blur(8px) saturate(1.4) brightness(0.6)', transform: 'scale(1.1)' } as CSSProperties}
          />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
        <div className={styles.coverGradient} />
        {!isLoading && (
          <span className={styles.coverLabel}>TOP ARTIST</span>
        )}
      </div>

      {/* Info area */}
      <div className={styles.infoArea}>
        {isLoading ? (
          <>
            <div className={styles.skeleton} style={{ height: '28px', width: '80%' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '10px', width: '50%', marginTop: '0.5rem' } as CSSProperties} />
          </>
        ) : artist ? (
          <>
            <h2 className={styles.artistName}>{artist.name}</h2>

            <div className={styles.divider} />

            <div className={styles.metaRow}>
              {artist.tags.map(tag => (
                <span key={tag} className={styles.genreTag}>{tag}</span>
              ))}
            </div>

            <div className={styles.statRow}>
              <span className={styles.statItem}>
                ×<span className={styles.statNum}>{artist.playCount}</span> 次
              </span>
              <span className={styles.statItem}>
                <span className={styles.statNum}>{artist.totalMinutes}</span> min
              </span>
              {artist.peakHour !== null && (
                <span className={styles.statItem}>
                  峰值 <span className={styles.statNum}>{String(artist.peakHour).padStart(2, '0')}:00</span>
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
