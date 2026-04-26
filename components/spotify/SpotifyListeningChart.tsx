'use client'

import { useState, type CSSProperties } from 'react'

import { aggregateTags } from '@/lib/spotify-tag-analysis'
import { TIME_SEGMENTS } from '@/lib/spotify-history-utils'
import type { SpotifyRecentlyPlayedTrack, SpotifyTrackTagStore, TimeSegmentId } from '@/lib/spotify-types'

import styles from './SpotifyRecentlyPlayedDeck.module.css'

function createTickValues(maxCount: number) {
  return [3, 2, 1, 0].map((step) => Math.ceil((maxCount * step) / 3))
}

function getSegmentForHour(hour: number) {
  return TIME_SEGMENTS.find((s) => hour >= s.startHour && hour < s.endHour) ?? TIME_SEGMENTS[0]!
}

function getTopTagLabel(
  segmentId: TimeSegmentId,
  hourMap: Map<number, SpotifyRecentlyPlayedTrack[]>,
  tagStore: SpotifyTrackTagStore | null
): string {
  const segment = TIME_SEGMENTS.find((s) => s.id === segmentId)!
  const fallback = `${segment.label}时刻`

  if (!tagStore) return fallback

  const trackIds: string[] = []
  for (let h = segment.startHour; h < segment.endHour; h++) {
    hourMap.get(h)?.forEach((t) => trackIds.push(t.id))
  }

  const top = aggregateTags(trackIds, tagStore)[0]
  return top ? `${top.name} 时刻` : fallback
}

const SEGMENT_HIGHLIGHT_COLOR: Record<TimeSegmentId, string> = {
  dawn: 'rgba(99,102,241,0.13)',
  morning: 'rgba(245,158,11,0.13)',
  noon: 'rgba(132,204,22,0.13)',
  afternoon: 'rgba(16,185,129,0.13)',
  evening: 'rgba(249,115,22,0.13)',
  night: 'rgba(139,92,246,0.13)',
}

export default function SpotifyListeningChart({
  hourMap,
  tagStore,
  selectedSegment,
  onSelectSegment,
  isLoading,
}: {
  hourMap: Map<number, SpotifyRecentlyPlayedTrack[]>
  tagStore: SpotifyTrackTagStore | null
  selectedSegment: TimeSegmentId | null
  onSelectSegment: (segmentId: TimeSegmentId) => void
  isLoading: boolean
}) {
  const [hoveredSegmentId, setHoveredSegmentId] = useState<TimeSegmentId | null>(null)
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)

  const hourCounts = Array.from({ length: 24 }, (_, h) => hourMap.get(h)?.length ?? 0)
  const rawMax = Math.max(...hourCounts, 1)
  const paddedMax = Math.ceil(rawMax * 1.15)
  const maxCount = Math.max(Math.ceil(paddedMax / 3) * 3, 3)
  const ticks = createTickValues(maxCount)

  const activeSegment = hoveredSegmentId ?? null
  const momentLabel = activeSegment ? getTopTagLabel(activeSegment, hourMap, tagStore) : ''

  const hoveredSegment = activeSegment ? TIME_SEGMENTS.find((s) => s.id === activeSegment) : null
  const highlightLeft = hoveredSegment ? `${(hoveredSegment.startHour / 24) * 100}%` : '0%'
  const highlightWidth = hoveredSegment
    ? `${((hoveredSegment.endHour - hoveredSegment.startHour) / 24) * 100}%`
    : '0%'
  const momentCenterLeft = hoveredSegment
    ? `${((hoveredSegment.startHour + hoveredSegment.endHour) / 2 / 24) * 100}%`
    : '50%'

  return (
    <div className={styles.chartShell} data-loading={isLoading ? 'true' : 'false'}>
      <div className={styles.chartYAxis} aria-hidden="true">
        {ticks.map((tick, index) => (
          <span key={`${tick}-${index}`}>{tick}</span>
        ))}
      </div>

      <div className={styles.chartPlotWrap}>
        <div
          className={styles.chartPlot}
          onMouseLeave={() => {
            setHoveredSegmentId(null)
            setHoveredHour(null)
          }}
        >
          <div className={styles.chartPlotInner}>
            {ticks.map((tick, index) => (
              <span
                key={`guide-${tick}-${index}`}
                className={styles.chartGuide}
                style={{ top: `${(index / Math.max(ticks.length - 1, 1)) * 100}%` }}
                aria-hidden="true"
              />
            ))}

            {/* segment background highlight */}
            <div
              className={styles.chartSegmentHighlight}
              data-visible={activeSegment ? 'true' : 'false'}
              style={{
                left: highlightLeft,
                width: highlightWidth,
                background: activeSegment ? SEGMENT_HIGHLIGHT_COLOR[activeSegment] : 'transparent',
              }}
              aria-hidden="true"
            />

            {/* "xx 时刻" floating label */}
            <div
              className={styles.chartMomentLabel}
              data-visible={activeSegment ? 'true' : 'false'}
              style={{ left: momentCenterLeft }}
              aria-hidden="true"
            >
              {momentLabel}
            </div>

            <div className={styles.chartBars}>
              {Array.from({ length: 24 }, (_, hour) => {
                const segment = getSegmentForHour(hour)
                const count = hourCounts[hour] ?? 0
                const isActive = segment.id === selectedSegment && count > 0
                const isHovered = hoveredSegmentId === segment.id
                const isDimmed = hoveredSegmentId !== null && !isHovered
                const barHeight = count === 0 ? 4 : Math.max((count / maxCount) * 100, 6)
                const barStyle = {
                  '--bar-delay': `${hour * 25}ms`,
                  '--bar-height': `${barHeight}%`,
                } as CSSProperties

                return (
                  <div key={hour} className={styles.chartColumn}>
                    <button
                      type="button"
                      className={styles.chartBarButton}
                      onClick={() => onSelectSegment(segment.id)}
                      onMouseEnter={() => {
                        setHoveredSegmentId(segment.id)
                        setHoveredHour(hour)
                      }}
                      disabled={count === 0}
                      aria-pressed={isActive}
                      aria-label={`${hour}时 ${count} 首`}
                    >
                      <span className={styles.chartBarWrap} style={barStyle}>
                        {hoveredHour === hour && count > 0 && (
                          <span className={styles.chartBarTooltip}>
                            {count}
                          </span>
                        )}
                        <span
                          className={[
                            styles.chartBar,
                            isActive ? styles.chartBarActive : '',
                            count === 0 ? styles.chartBarMuted : '',
                            isHovered ? styles.chartBarHovered : '',
                            isDimmed ? styles.chartBarDimmed : '',
                          ].filter(Boolean).join(' ')}
                          data-segment={segment.id}
                        />
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* X-axis segment labels row */}
        <div className={styles.chartSegmentLabels} aria-hidden="true">
          {TIME_SEGMENTS.map((seg) => {
            const span = seg.endHour - seg.startHour
            return (
              <div
                key={seg.id}
                className={[
                  styles.chartSegmentLabelItem,
                  hoveredSegmentId === seg.id ? styles.chartSegmentLabelItemActive : '',
                ].filter(Boolean).join(' ')}
                style={{ gridColumn: `span ${span}` }}
              >
                <span className={styles.chartSegmentName}>{seg.label}</span>
                <span className={styles.chartSegmentHours}>{seg.startHour}–{seg.endHour}时</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
