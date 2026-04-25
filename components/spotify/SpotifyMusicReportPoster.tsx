'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import gsap from 'gsap'

import type { MusicReportStats } from '@/lib/spotify-report'

import styles from './SpotifyMusicReportBoard.module.css'

const RESTING_SHADOW =
  '0 14px 22px -10px rgba(15, 10, 0, 0.28), inset 0 20px 28px -10px rgba(0, 0, 0, 0.22)'
const LIFTED_SHADOW =
  '-2px 22px 48px -6px rgba(0, 0, 0, 0.2), inset 0 16px 22px -10px rgba(0, 0, 0, 0.18)'

// Per-period visual identity
const PERIOD_CONFIG = {
  day: {
    accentColor: '#d4631a',
    label: '日报',
    eyebrow: 'DAILY',
    contextIcon: '♫',
    width: 182,
    rotation: -2.4,
    pinColor: '#c0392b',
  },
  week: {
    accentColor: '#2e7d52',
    label: '周报',
    eyebrow: 'WEEKLY',
    contextIcon: '⟳',
    width: 218,
    rotation: 1.2,
    pinColor: '#1a5c35',
  },
  month: {
    accentColor: '#3b4fa0',
    label: '月报',
    eyebrow: 'MONTHLY',
    contextIcon: '◈',
    width: 260,
    rotation: -0.7,
    pinColor: '#263694',
  },
} as const

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

function contextTypeIcon(type: string) {
  if (type === 'album') return '💿'
  if (type === 'artist') return '🎤'
  return '🎵'
}

interface Props {
  stats: MusicReportStats
  isLoading?: boolean
}

export default function SpotifyMusicReportPoster({ stats, isLoading }: Props) {
  const config = PERIOD_CONFIG[stats.period]
  const surfaceRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  const baseRotation = config.rotation

  // Initialise resting rotation
  useEffect(() => {
    if (!surfaceRef.current) return
    gsap.set(surfaceRef.current, { rotation: baseRotation })
  }, [baseRotation])

  function handleMouseEnter() {
    const surface = surfaceRef.current
    const paper = paperRef.current
    if (!surface || !paper) return

    gsap.killTweensOf(surface)
    gsap.killTweensOf(paper)

    const tl = gsap.timeline()
    tl.to(surface, { rotateX: 6, duration: 0.22 })
      .to(paper, { boxShadow: LIFTED_SHADOW, duration: 0.22 }, 0)
      .to(
        surface,
        {
          rotation: baseRotation * 0.25,
          rotateX: 4,
          scale: 1.04,
          y: -8,
          ease: 'elastic.out(0.75, 0.5)',
          duration: 0.65,
        },
        0.14
      )
      .to(paper, { boxShadow: LIFTED_SHADOW, ease: 'elastic.out(0.75, 0.5)', duration: 0.65 }, 0.14)
  }

  function handleMouseLeave() {
    const surface = surfaceRef.current
    const paper = paperRef.current
    if (!surface || !paper) return

    gsap.killTweensOf(surface)
    gsap.killTweensOf(paper)

    const tl = gsap.timeline()
    tl.to(surface, { rotateX: 12, duration: 0.18 })
      .to(paper, { boxShadow: RESTING_SHADOW, duration: 0.18 }, 0)
      .to(
        surface,
        {
          rotation: baseRotation,
          rotateX: 0,
          scale: 1,
          y: 0,
          ease: 'elastic.out(0.8, 0.5)',
          duration: 0.6,
        },
        0.12
      )
      .to(paper, { boxShadow: RESTING_SHADOW, ease: 'elastic.out(0.8, 0.5)', duration: 0.6 }, 0.12)
  }

  const wrapStyle: CSSProperties = { width: `${config.width}px` }

  return (
    <div className={styles.posterWrap} style={wrapStyle}>
      {/* Push-pin */}
      <div className={styles.pin} />

      {/* Tape */}
      <div className={styles.tape} />

      {/* 3D surface */}
      <div
        ref={surfaceRef}
        className={styles.posterSurface}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div ref={paperRef} className={styles.poster}>
          {/* Period accent bar */}
          <div className={styles.accentBar} style={{ background: config.accentColor }} />

          <div className={styles.posterBody}>
            {/* Header row */}
            <div className={styles.posterMeta}>
              <span className={styles.periodLabel}>{config.eyebrow} REPORT</span>
              <span className={styles.dateRange}>{stats.dateRange}</span>
            </div>

            <div className={styles.divider} />

            {isLoading ? (
              /* Loading skeleton */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.4rem 0' }}>
                <div className={styles.skeleton} style={{ height: '44px', borderRadius: '3px' }} />
                <div className={styles.skeleton} style={{ height: '12px', width: '70%' }} />
                <div className={styles.skeleton} style={{ height: '12px', width: '50%' }} />
              </div>
            ) : stats.totalPlays === 0 ? (
              /* Rest day */
              <div className={styles.restDay}>
                <div className={styles.restDayStamp}>REST</div>
                <span className={styles.restDayLabel}>今{stats.period === 'day' ? '日' : stats.period === 'week' ? '周' : '月'}无演出</span>
              </div>
            ) : (
              <>
                {/* Headline act */}
                {stats.topTrack && (
                  <div className={styles.headlineWrap}>
                    {stats.topTrack.albumImageUrl ? (
                      <img
                        className={styles.albumThumb}
                        src={stats.topTrack.albumImageUrl}
                        alt={stats.topTrack.title}
                        width={44}
                        height={44}
                      />
                    ) : (
                      <div className={styles.albumThumbPlaceholder} />
                    )}
                    <div className={styles.headlineText}>
                      <span className={styles.headlineEyebrow}>HEADLINE ACT</span>
                      <span className={styles.headlineTrack}>{stats.topTrack.title}</span>
                      <span className={styles.headlineArtist}>{stats.topTrack.artist}</span>
                      {stats.topTrack.playCount > 1 && (
                        <span className={styles.playCount}>×{stats.topTrack.playCount} plays</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Context loyalty */}
                {stats.topContext && (
                  <>
                    <div className={styles.divider} />
                    <div className={styles.sectionLabel}>FAITHFUL TO</div>
                    <div className={styles.contextRow}>
                      <span className={styles.contextIcon}>
                        {contextTypeIcon(stats.topContext.type)}
                      </span>
                      <div className={styles.contextInfo}>
                        <div className={styles.contextName}>{stats.topContext.label}</div>
                        <div className={styles.contextCount}>
                          {stats.topContext.playCount} plays
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Top tag */}
                {stats.topTag && (
                  <>
                    <div className={styles.divider} />
                    <div className={styles.sectionLabel}>VIBE</div>
                    <div className={styles.tagRow}>
                      <span className={styles.tag} style={{ borderColor: `${config.accentColor}40`, color: config.accentColor }}>
                        {stats.topTag}
                      </span>
                      {stats.topArtist && (
                        <span className={styles.tag}>{stats.topArtist.name}</span>
                      )}
                    </div>
                  </>
                )}

                {/* Stats footer */}
                <div className={styles.divider} />
                <div className={styles.statsRow}>
                  <span className={styles.statItem}>
                    <span className={styles.statHighlight}>{stats.totalPlays}</span> songs
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statHighlight}>{stats.totalMinutes}</span> min
                  </span>
                  {stats.peakHour !== null && (
                    <span className={styles.statItem}>
                      peak <span className={styles.statHighlight}>{formatHour(stats.peakHour)}</span>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
