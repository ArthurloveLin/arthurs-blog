'use client'

import type { CSSProperties } from 'react'

import { TIME_SEGMENTS } from '@/lib/spotify-history-utils'
import type { SpotifyRecentlyPlayedTrack, TimeSegmentId } from '@/lib/spotify-types'

import styles from './SpotifyRecentlyPlayedDeck.module.css'

function createTickValues(maxCount: number) {
  return [3, 2, 1, 0].map((step) => Math.ceil((maxCount * step) / 3))
}

export default function SpotifyListeningChart({
  segmentMap,
  selectedSegment,
  onSelectSegment,
  isLoading,
}: {
  segmentMap: Map<TimeSegmentId, SpotifyRecentlyPlayedTrack[]>
  selectedSegment: TimeSegmentId | null
  onSelectSegment: (segmentId: TimeSegmentId) => void
  isLoading: boolean
}) {
  const counts = TIME_SEGMENTS.map((segment) => segmentMap.get(segment.id)?.length ?? 0)
  const maxCount = Math.max(...counts, 1)
  const ticks = createTickValues(maxCount)

  return (
    <div className={styles.chartShell} data-loading={isLoading ? 'true' : 'false'}>
      <div className={styles.chartYAxis} aria-hidden="true">
        {ticks.map((tick, index) => (
          <span key={`${tick}-${index}`}>{tick}</span>
        ))}
      </div>

      <div className={styles.chartPlot}>
        {ticks.map((tick, index) => (
          <span
            key={`guide-${tick}-${index}`}
            className={styles.chartGuide}
            style={{ top: `${(index / Math.max(ticks.length - 1, 1)) * 100}%` }}
            aria-hidden="true"
          />
        ))}

        <div className={styles.chartBars}>
          {TIME_SEGMENTS.map((segment, index) => {
            const count = counts[index]
            const isActive = segment.id === selectedSegment && count > 0
            const barHeight = count === 0 ? 8 : Math.max((count / maxCount) * 100, 14)
            const style = {
              '--bar-delay': `${index * 60}ms`,
              '--bar-height': `${barHeight}%`,
            } as CSSProperties

            return (
              <div key={segment.id} className={styles.chartColumn}>
                <button
                  type="button"
                  className={styles.chartBarButton}
                  onClick={() => onSelectSegment(segment.id)}
                  disabled={count === 0}
                  aria-pressed={isActive}
                  aria-label={`${segment.label} ${count} 首`}
                >
                  <span className={styles.chartTooltip}>{count} 首</span>
                  <span
                    className={[
                      styles.chartBar,
                      isActive ? styles.chartBarActive : '',
                      count === 0 ? styles.chartBarMuted : '',
                    ].filter(Boolean).join(' ')}
                    style={style}
                  />
                </button>
                <div className={styles.chartLabelGroup}>
                  <span className={styles.chartLabel}>{segment.label}</span>
                  <span className={styles.chartValue}>{count} 首</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}