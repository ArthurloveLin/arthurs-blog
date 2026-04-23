'use client'

import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react'

import { formatDateLabel, segmentTracksByTime, TIME_SEGMENTS } from '@/lib/spotify-history-utils'
import { formatStableDate } from '@/lib/date-format'
import type { SpotifyRecentlyPlayedTrack, TimeSegmentId } from '@/lib/spotify-types'

import RecentlyPlayedViewToggle from './RecentlyPlayedViewToggle'
import SpotifyListeningChart from './SpotifyListeningChart'
import styles from './SpotifyRecentlyPlayedDeck.module.css'

const DEFAULT_CARDS_PER_PAGE = 4

type RecentlyPlayedView = 'timeline' | 'chart'

type DaysResponse = {
  days: string[]
}

function resolveCardsPerPage(width: number) {
  if (width < 640) return 1
  if (width < 1024) return 2
  if (width < 1440) return 3
  return 4
}

function chunkItems(items: SpotifyRecentlyPlayedTrack[], size: number) {
  const groups: SpotifyRecentlyPlayedTrack[][] = []

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }

  return groups
}

function formatPlayedAt(value: string) {
  return formatStableDate(value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getFirstAvailableSegmentId(segmentMap: Map<TimeSegmentId, SpotifyRecentlyPlayedTrack[]>) {
  for (const segment of TIME_SEGMENTS) {
    if ((segmentMap.get(segment.id)?.length ?? 0) > 0) {
      return segment.id
    }
  }

  return null
}

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function HistoryDaySelector({
  days,
  selectedDate,
  onSelect,
}: {
  days: string[]
  selectedDate: string | null
  onSelect: (day: string) => void
}) {
  if (days.length === 0) {
    return null
  }

  return (
    <div className={styles.timelineScroller}>
      {days.map((day) => {
        const isActive = day === selectedDate

        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            className={[styles.timelinePill, isActive ? styles.timelinePillActive : ''].filter(Boolean).join(' ')}
          >
            {formatDateLabel(day)}
          </button>
        )
      })}
    </div>
  )
}

function TimeSegmentSelector({
  segmentMap,
  selectedSegment,
  onSelect,
}: {
  segmentMap: Map<TimeSegmentId, SpotifyRecentlyPlayedTrack[]>
  selectedSegment: TimeSegmentId | null
  onSelect: (segmentId: TimeSegmentId) => void
}) {
  return (
    <div className={styles.segmentScroller}>
      {TIME_SEGMENTS.map((segment) => {
        const count = segmentMap.get(segment.id)?.length ?? 0
        const isActive = count > 0 && segment.id === selectedSegment

        return (
          <button
            key={segment.id}
            type="button"
            onClick={() => onSelect(segment.id)}
            disabled={count === 0}
            className={[
              styles.segmentPill,
              isActive ? styles.segmentPillActive : '',
              count === 0 ? styles.segmentPillDisabled : '',
            ].filter(Boolean).join(' ')}
          >
            <span>{segment.label}</span>
            <span className={styles.segmentCount}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}

function RecentlyPlayedParallaxCard({ item }: { item: SpotifyRecentlyPlayedTrack }) {
  const leaveTimerRef = useRef<number | null>(null)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current)
      }
    }
  }, [])

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const nextX = (event.clientX - bounds.left - bounds.width / 2) / bounds.width
    const nextY = (event.clientY - bounds.top - bounds.height / 2) / bounds.height
    setPointer({ x: nextX, y: nextY })
  }

  const handlePointerEnter = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }

  const handlePointerLeave = () => {
    leaveTimerRef.current = window.setTimeout(() => {
      setPointer({ x: 0, y: 0 })
    }, 1000)
  }

  const sourceLabel = item.context?.label ?? '未知来源'
  const cardStyle = {
    '--card-rotate-y': `${pointer.x * 30}deg`,
    '--card-rotate-x': `${pointer.y * -30}deg`,
    '--card-bg-x': `${pointer.x * -40}px`,
    '--card-bg-y': `${pointer.y * -40}px`,
  } as CSSProperties

  return (
    <article
      className={styles.cardWrap}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={cardStyle}
    >
      <div className={styles.card}>
        <div
          className={styles.cardBg}
          style={item.albumImageUrl ? { backgroundImage: `url(${item.albumImageUrl})` } : undefined}
        />
        {item.albumImageUrl ? null : (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <Music2 className="h-10 w-10" strokeWidth={1.6} />
          </div>
        )}
        <div className={styles.cardShade} />
        <div className={styles.infoOverlay} />

        <div className={styles.cardInfo}>
          <h3 className={styles.title}>{item.title}</h3>

          <div className={styles.metaGroup}>
            <p className={styles.metaRow}>{item.artists.join(', ')}</p>
            <p className={styles.metaRow}>
              <span className={styles.mutedLabel}>听于</span>
              {formatPlayedAt(item.playedAt)}
            </p>
            <p className={styles.metaRow}>
              <span className={styles.mutedLabel}>来自</span>
              {sourceLabel}
            </p>
            <span className={styles.spotifyBadge}>{item.album}</span>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function SpotifyRecentlyPlayedDeck({ items }: { items: SpotifyRecentlyPlayedTrack[] }) {
  const [view, setView] = useState<RecentlyPlayedView>('timeline')
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<TimeSegmentId | null>(null)
  const [historyTracks, setHistoryTracks] = useState<SpotifyRecentlyPlayedTrack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [cardsPerPage, setCardsPerPage] = useState(DEFAULT_CARDS_PER_PAGE)
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)

  useEffect(() => {
    const updateCardsPerPage = () => {
      setCardsPerPage(resolveCardsPerPage(window.innerWidth))
    }

    updateCardsPerPage()
    window.addEventListener('resize', updateCardsPerPage)
    return () => window.removeEventListener('resize', updateCardsPerPage)
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function loadAvailableDays() {
      try {
        const data = await readJson<DaysResponse>('/api/spotify/history/days')

        if (isCancelled) {
          return
        }

        startTransition(() => {
          setAvailableDays(data.days)
          setSelectedDate((current) => current ?? data.days[0] ?? null)
        })
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load Spotify history days:', error)
        }
      }
    }

    void loadAvailableDays()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedDate) {
      setHistoryTracks([])
      return
    }

    const controller = new AbortController()

    async function loadHistoryTracks() {
      setIsLoading(true)

      try {
        const params = new URLSearchParams({ date: selectedDate ?? '' })
        const nextTracks = await readJson<SpotifyRecentlyPlayedTrack[]>(
          `/api/spotify/history?${params.toString()}`,
          controller.signal
        )

        startTransition(() => {
          setHistoryTracks(nextTracks)
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load Spotify history tracks:', error)
          setHistoryTracks([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadHistoryTracks()

    return () => {
      controller.abort()
    }
  }, [selectedDate])

  const effectiveTracks = historyTracks.length > 0 ? historyTracks : items
  const effectiveSegmentMap = useMemo(() => segmentTracksByTime(effectiveTracks), [effectiveTracks])

  useEffect(() => {
    const firstAvailableSegment = getFirstAvailableSegmentId(effectiveSegmentMap)

    setSelectedSegment((current) => {
      if (current && (effectiveSegmentMap.get(current)?.length ?? 0) > 0) {
        return current
      }

      return firstAvailableSegment
    })
  }, [effectiveSegmentMap])

  useEffect(() => {
    setCurrentGroupIndex(0)
  }, [selectedDate, selectedSegment, view])

  const activeTracks = useMemo(() => {
    if (!selectedSegment) {
      return effectiveTracks
    }

    return effectiveSegmentMap.get(selectedSegment) ?? []
  }, [effectiveSegmentMap, effectiveTracks, selectedSegment])

  const groups = useMemo(() => chunkItems(activeTracks, cardsPerPage), [activeTracks, cardsPerPage])
  const isShowingFallback = historyTracks.length === 0
  const hasAnyTracks = effectiveTracks.length > 0

  if (!hasAnyTracks) {
    return <div className={styles.emptyState}>当前没有可展示的 Recently Played 数据。</div>
  }

  const effectiveGroupIndex = Math.min(currentGroupIndex, Math.max(groups.length - 1, 0))
  const currentGroup = groups[effectiveGroupIndex] ?? []
  const hasMultipleGroups = groups.length > 1
  const activeDayLabel = selectedDate ? formatDateLabel(selectedDate) : '最近播放'

  const handlePrevious = () => {
    startTransition(() => {
      setCurrentGroupIndex(Math.max(0, effectiveGroupIndex - 1))
    })
  }

  const handleNext = () => {
    startTransition(() => {
      setCurrentGroupIndex(Math.min(groups.length - 1, effectiveGroupIndex + 1))
    })
  }

  const handleSelectDay = (day: string) => {
    if (day === selectedDate) {
      return
    }

    startTransition(() => {
      setSelectedDate(day)
    })
  }

  const handleSelectSegment = (segmentId: TimeSegmentId) => {
    if ((effectiveSegmentMap.get(segmentId)?.length ?? 0) === 0) {
      return
    }

    startTransition(() => {
      setSelectedSegment(segmentId)
    })
  }

  const handleSelectChartSegment = (segmentId: TimeSegmentId) => {
    if ((effectiveSegmentMap.get(segmentId)?.length ?? 0) === 0) {
      return
    }

    startTransition(() => {
      setView('timeline')
      setSelectedSegment(segmentId)
    })
  }

  return (
    <div className={styles.section}>
      <div className={styles.viewHeader}>
        <div>
          <p className={styles.historyCaption}>{activeDayLabel}</p>
          <p className={styles.historySummary}>
            {selectedSegment ? `${TIME_SEGMENTS.find((segment) => segment.id === selectedSegment)?.label ?? '全部时段'} · ` : ''}
            {activeTracks.length} 首
          </p>
        </div>
        <RecentlyPlayedViewToggle view={view} onChange={setView} />
      </div>

      {view === 'timeline' ? (
        <>
          <div className={styles.viewportWrap} data-loading={isLoading ? 'true' : 'false'}>
            <div className={styles.viewport}>
              {hasMultipleGroups ? (
                <>
                  <button
                    type="button"
                    className={[styles.navButton, styles.navButtonLeft].join(' ')}
                    onClick={handlePrevious}
                    disabled={effectiveGroupIndex === 0}
                    aria-label="查看上一组最近播放"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className={[styles.navButton, styles.navButtonRight].join(' ')}
                    onClick={handleNext}
                    disabled={effectiveGroupIndex === groups.length - 1}
                    aria-label="查看下一组最近播放"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
                  </button>
                </>
              ) : null}

              <div
                key={`${selectedDate ?? 'fallback'}-${selectedSegment ?? 'all'}-${cardsPerPage}-${effectiveGroupIndex}`}
                className={[styles.grid, 'animate-in fade-in slide-in-from-right-4 duration-500'].join(' ')}
                style={{ gridTemplateColumns: `repeat(${cardsPerPage}, minmax(0, 1fr))` }}
              >
                {currentGroup.map((item, index) => (
                  <RecentlyPlayedParallaxCard key={`${item.id}-${item.playedAt}-${index}`} item={item} />
                ))}
                {Array.from({ length: cardsPerPage - currentGroup.length }).map((_, i) => (
                  <div key={`placeholder-${i}`} aria-hidden="true" />
                ))}
              </div>
            </div>
          </div>

          {hasMultipleGroups ? (
            <div className={styles.statusBar}>
              <div className={styles.paginationDots} aria-hidden="true">
                {groups.map((_, index) => (
                  <span
                    key={`recently-played-dot-${index}`}
                    className={[
                      styles.paginationDot,
                      index === effectiveGroupIndex ? styles.paginationDotActive : '',
                    ].filter(Boolean).join(' ')}
                  />
                ))}
              </div>
              <p className={styles.pageLabel}>
                第 {effectiveGroupIndex + 1} 页 / 共 {groups.length} 页
              </p>
            </div>
          ) : null}

          <div className={styles.timelineMeta}>
            <HistoryDaySelector days={availableDays} selectedDate={selectedDate} onSelect={handleSelectDay} />
            <TimeSegmentSelector
              segmentMap={effectiveSegmentMap}
              selectedSegment={selectedSegment}
              onSelect={handleSelectSegment}
            />
            <p className={styles.helperText}>
              {isLoading
                ? `正在加载 ${activeDayLabel} 的播放历史...`
                : selectedDate && isShowingFallback && items.length > 0
                  ? '该日期尚无日分片归档，暂时显示 dashboard 的最近 12 首记录。'
                  : selectedDate
                    ? `${activeDayLabel} 已归档 ${effectiveTracks.length} 首播放记录。`
                    : '当前展示 dashboard 的最近 12 首记录。'}
            </p>
          </div>
        </>
      ) : (
        <div className={styles.chartPanel}>
          <HistoryDaySelector days={availableDays} selectedDate={selectedDate} onSelect={handleSelectDay} />
          <SpotifyListeningChart
            segmentMap={effectiveSegmentMap}
            selectedSegment={selectedSegment}
            onSelectSegment={handleSelectChartSegment}
            isLoading={isLoading}
          />
          <p className={styles.helperText}>
            点击柱状图可跳回时间轴对应时段。{selectedDate ? `当前日期：${activeDayLabel}。` : ''}
          </p>
        </div>
      )}
    </div>
  )
}