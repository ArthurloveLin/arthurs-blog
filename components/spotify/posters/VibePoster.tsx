'use client'

import type { CSSProperties } from 'react'
import type { MusicReportStats } from '@/lib/spotify-report'
import styles from './VibePoster.module.css'

interface TagPalette {
  bg: string
  text: string
  accent: string
  barColor: string
}

const TAG_PALETTE: Record<string, TagPalette> = {
  'pop':         { bg: '#3d0b1a', text: '#ffd6e2', accent: '#ff3c6e', barColor: '#ff3c6e' },
  'rock':        { bg: '#1a0a00', text: '#ffc4a0', accent: '#ff6b35', barColor: '#ff6b35' },
  'jazz':        { bg: '#001828', text: '#b3e8ff', accent: '#63d2ff', barColor: '#63d2ff' },
  'classical':   { bg: '#1a1208', text: '#f5e08a', accent: '#d4af37', barColor: '#d4af37' },
  'electronic':  { bg: '#0d0020', text: '#e0b3ff', accent: '#bf5fff', barColor: '#bf5fff' },
  'hip-hop':     { bg: '#0f0f0f', text: '#fff3b0', accent: '#ffd700', barColor: '#ffd700' },
  'r&b':         { bg: '#1a0515', text: '#ffb3e2', accent: '#ff79c6', barColor: '#ff79c6' },
  'indie':       { bg: '#0e1a0a', text: '#c8e8b4', accent: '#78b85a', barColor: '#78b85a' },
  'folk':        { bg: '#1a1208', text: '#e8d8b0', accent: '#c8a060', barColor: '#c8a060' },
  'metal':       { bg: '#0a0a0a', text: '#d0d0d0', accent: '#888888', barColor: '#888888' },
  'punk':        { bg: '#1a0020', text: '#ffd0ff', accent: '#cc44cc', barColor: '#cc44cc' },
  'soul':        { bg: '#1a0808', text: '#ffd0a0', accent: '#e06030', barColor: '#e06030' },
  'blues':       { bg: '#080820', text: '#b0c8ff', accent: '#4060d8', barColor: '#4060d8' },
  'country':     { bg: '#1a1000', text: '#f0e0a0', accent: '#c09028', barColor: '#c09028' },
  'default':     { bg: '#2d0845', text: '#d4a8ff', accent: '#8b5cf6', barColor: '#8b5cf6' },
}

function getPalette(tag: string | null): TagPalette {
  if (!tag) return TAG_PALETTE.default
  const key = tag.toLowerCase()
  return TAG_PALETTE[key] ?? TAG_PALETTE.default
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
  const { topTag, topContext, period } = stats

  const posterStyle: CSSProperties = {
    '--vibe-bg': palette.bg,
    '--vibe-text': palette.text,
    '--vibe-accent': palette.accent,
  } as CSSProperties

  return (
    <div
      className={`${styles.poster} ${isTransitioning ? styles.transitioning : ''}`}
      style={posterStyle}
    >
      {/* Accent bar */}
      <div className={styles.accentBar} style={{ background: palette.barColor }} />

      {/* Background pattern */}
      <div className={styles.bgPattern} />

      <div className={styles.content}>
        <span className={styles.eyebrow}>YOUR VIBE</span>

        {isLoading ? (
          <>
            <div className={styles.skeleton} style={{ height: '36px', width: '80%', marginTop: '1rem' } as CSSProperties} />
            <div className={styles.skeleton} style={{ height: '10px', width: '55%', marginTop: '0.6rem' } as CSSProperties} />
          </>
        ) : (
          <>
            {/* Big vibe tag */}
            <div className={styles.vibeTagBanner}>
              {topTag ?? 'MUSIC'}
            </div>

            {/* Context source */}
            {topContext ? (
              <div className={styles.contextSection}>
                <span className={styles.contextIcon}>{contextTypeIcon(topContext.type)}</span>
                <div className={styles.contextInfo}>
                  <div className={styles.contextName}>{topContext.label}</div>
                  <div className={styles.contextCount}>{topContext.playCount} plays</div>
                </div>
              </div>
            ) : (
              <div className={styles.emptyLabel}>
                今{period === 'day' ? '日' : period === 'week' ? '周' : '月'}暂无数据
              </div>
            )}
          </>
        )}

        <div className={styles.footer}>
          <span className={styles.footerMeta}>{stats.dateRange}</span>
        </div>
      </div>
    </div>
  )
}
