'use client'

import type { CSSProperties } from 'react'
import type { MusicReportStats } from '@/lib/spotify-report'
import styles from './VibePoster.module.css'

interface TagPalette {
  bg: string
  text: string
  accent: string
  barColor: string
  dimText: string
}

const TAG_PALETTE: Record<string, TagPalette> = {
  'pop':         { bg: '#3d0b1a', text: '#ffd6e2', accent: '#ff3c6e', barColor: '#ff3c6e', dimText: 'rgba(255,214,226,0.5)' },
  'rock':        { bg: '#1a0a00', text: '#ffc4a0', accent: '#ff6b35', barColor: '#ff6b35', dimText: 'rgba(255,196,160,0.5)' },
  'jazz':        { bg: '#001828', text: '#b3e8ff', accent: '#63d2ff', barColor: '#63d2ff', dimText: 'rgba(179,232,255,0.5)' },
  'classical':   { bg: '#1a1208', text: '#f5e08a', accent: '#d4af37', barColor: '#d4af37', dimText: 'rgba(245,224,138,0.5)' },
  'electronic':  { bg: '#0d0020', text: '#e0b3ff', accent: '#bf5fff', barColor: '#bf5fff', dimText: 'rgba(224,179,255,0.5)' },
  'hip-hop':     { bg: '#0f0f0f', text: '#fff3b0', accent: '#ffd700', barColor: '#ffd700', dimText: 'rgba(255,243,176,0.5)' },
  'r&b':         { bg: '#1a0515', text: '#ffb3e2', accent: '#ff79c6', barColor: '#ff79c6', dimText: 'rgba(255,179,226,0.5)' },
  'indie':       { bg: '#0e1a0a', text: '#c8e8b4', accent: '#78b85a', barColor: '#78b85a', dimText: 'rgba(200,232,180,0.5)' },
  'folk':        { bg: '#1a1208', text: '#e8d8b0', accent: '#c8a060', barColor: '#c8a060', dimText: 'rgba(232,216,176,0.5)' },
  'metal':       { bg: '#0a0a0a', text: '#d0d0d0', accent: '#888888', barColor: '#888888', dimText: 'rgba(208,208,208,0.5)' },
  'punk':        { bg: '#1a0020', text: '#ffd0ff', accent: '#cc44cc', barColor: '#cc44cc', dimText: 'rgba(255,208,255,0.5)' },
  'soul':        { bg: '#1a0808', text: '#ffd0a0', accent: '#e06030', barColor: '#e06030', dimText: 'rgba(255,208,160,0.5)' },
  'blues':       { bg: '#080820', text: '#b0c8ff', accent: '#4060d8', barColor: '#4060d8', dimText: 'rgba(176,200,255,0.5)' },
  'country':     { bg: '#1a1000', text: '#f0e0a0', accent: '#c09028', barColor: '#c09028', dimText: 'rgba(240,224,160,0.5)' },
  'default':     { bg: '#2d0845', text: '#d4a8ff', accent: '#8b5cf6', barColor: '#8b5cf6', dimText: 'rgba(212,168,255,0.5)' },
}

function getPalette(tag: string | null): TagPalette {
  if (!tag) return TAG_PALETTE.default
  return TAG_PALETTE[tag.toLowerCase()] ?? TAG_PALETTE.default
}

function contextTypeIcon(type: string) {
  if (type === 'album') return '💿'
  if (type === 'artist') return '🎤'
  return '🎵'
}

interface Props {
  stats: MusicReportStats
  isLoading?: boolean
  isTransitioning?: boolean
}

export default function VibePoster({ stats, isLoading, isTransitioning }: Props) {
  const palette = getPalette(stats.topTag)
  const { topTag, topContext, topArtist, period, totalPlays, totalMinutes, peakHour } = stats
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const posterStyle: CSSProperties = {
    '--vibe-bg': palette.bg,
    '--vibe-text': palette.text,
    '--vibe-accent': palette.accent,
    '--vibe-dim': palette.dimText,
  } as CSSProperties

  return (
    <div
      className={`${styles.poster} ${isTransitioning ? styles.transitioning : ''}`}
      style={posterStyle}
    >
      <div className={styles.accentBar} style={{ background: palette.barColor }} />
      <div className={styles.bgPattern} />

      <div className={styles.content}>
        <span className={styles.eyebrow}>YOUR VIBE</span>

        {isLoading ? (
          <>
            <div className={styles.skeleton} style={{ height: '40px', width: '80%', marginTop: '0.7rem' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '10px', width: '55%', marginTop: '0.6rem' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '36px', width: '100%', marginTop: '0.8rem', borderRadius: '6px' } as CSSProperties} />
          </>
        ) : (
          <>
            {/* Big vibe tag */}
            <div className={styles.vibeTagBanner}>
              {topTag ?? 'MUSIC'}
            </div>

            <div className={styles.divider} />

            {/* Context source */}
            {topContext ? (
              <div className={styles.contextSection}>
                <span className={styles.contextIcon}>{contextTypeIcon(topContext.type)}</span>
                <div className={styles.contextInfo}>
                  <div className={styles.contextName}>{topContext.label}</div>
                  <div className={styles.contextCount}>{topContext.playCount} plays</div>
                </div>
              </div>
            ) : topArtist ? (
              <div className={styles.artistSection}>
                <span className={styles.artistLabel}>最多播放</span>
                <span className={styles.artistName}>{topArtist.name}</span>
              </div>
            ) : null}

            {/* Bottom stats row */}
            <div className={styles.statsRow}>
              <span className={styles.statItem}>
                <span className={styles.statNum}>{totalPlays}</span> 首
              </span>
              {totalMinutes > 0 && (
                <span className={styles.statItem}>
                  {hours > 0 ? <><span className={styles.statNum}>{hours}</span>h </> : null}
                  <span className={styles.statNum}>{mins}</span>min
                </span>
              )}
              {peakHour !== null && (
                <span className={styles.statItem}>
                  峰值 <span className={styles.statNum}>{String(peakHour).padStart(2,'0')}:00</span>
                </span>
              )}
            </div>
          </>
        )}

        <div className={styles.footer}>
          <span className={styles.footerMeta}>{stats.dateRange}</span>
        </div>
      </div>
    </div>
  )
}
