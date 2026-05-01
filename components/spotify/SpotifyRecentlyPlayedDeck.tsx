'use client'

import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react'

import {
  buildWeekDayKeys,
  formatCompactDateLabel,
  formatDateLabel,
  formatFullDateLabel,
  formatWeekdayLabel,
  groupTracksByHour,
  segmentTracksByTime,
  TIME_SEGMENTS,
} from '@/lib/spotify-history-utils'
import { formatStableDate } from '@/lib/date-format'
import type { SpotifyRecentlyPlayedTrack, SpotifyTrackTagStore, TimeSegmentId } from '@/lib/spotify-types'

import dynamic from 'next/dynamic'
import styles from './SpotifyRecentlyPlayedDeck.module.css'

const SpotifyListeningChart = dynamic(() => import('./SpotifyListeningChart'), { ssr: false })
const SpotifyTagStreamChart = dynamic(() => import('./SpotifyTagStreamChart'), { ssr: false })

const DEFAULT_CARDS_PER_PAGE = 4

type RecentlyPlayedView = 'timeline' | 'chart' | 'stream'

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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuContentRef = useRef<HTMLDivElement | null>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  
  // Use the selected date or current date as the initial month view
  const initialViewDate = useMemo(() => {
    if (selectedDate) return new Date(selectedDate)
    if (days.length > 0) return new Date(days[0])
    return new Date()
  }, [selectedDate, days])

  const [viewDate, setViewDate] = useState(new Date(initialViewDate.getFullYear(), initialViewDate.getMonth(), 1))

  const availableDaySet = useMemo(() => new Set(days), [days])
  const weekDays = useMemo(
    () => buildWeekDayKeys(selectedDate ?? days[0] ?? null).map((day) => ({
      day,
      hasData: availableDaySet.has(day),
    })),
    [availableDaySet, days, selectedDate]
  )

  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay()
    const startDate = new Date(year, month, 1 - startOffset)
    
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return {
        date: d,
        key,
        isCurrentMonth: d.getMonth() === month,
        hasData: availableDaySet.has(key),
        isToday: key === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
        isActive: key === selectedDate
      }
    })
  }, [viewDate, availableDaySet, selectedDate])

  const updateMenuPosition = useCallback(() => {
    if (!isMenuOpen || !buttonRef.current || !menuRef.current) return

    const buttonRect = buttonRef.current.getBoundingClientRect()
    const railRect = menuRef.current.getBoundingClientRect()
    
    // We want to center the menu above the button
    let left = buttonRect.left - railRect.left + buttonRect.width / 2
    
    // Default menu width is 19.5rem = 312px (approx)
    // If menuContentRef is available, we use its real width
    const menuWidth = menuContentRef.current?.getBoundingClientRect().width ?? 312
    const halfMenuWidth = menuWidth / 2
    
    // Clamp the position to ensure it stays within the rail
    const minLeft = halfMenuWidth
    const maxLeft = railRect.width - halfMenuWidth
    
    // If the rail is narrower than the menu, just align to the left
    if (railRect.width < menuWidth) {
      setMenuStyle({
        left: '0',
        transform: 'none',
        right: 'auto',
      })
      return
    }

    left = Math.max(minLeft, Math.min(maxLeft, left))

    setMenuStyle({
      left: `${left}px`,
      transform: 'translateX(-50%)',
      right: 'auto',
    })
  }, [isMenuOpen])

  useLayoutEffect(() => {
    if (isMenuOpen) {
      const handle = requestAnimationFrame(updateMenuPosition)
      
      const scroller = scrollerRef.current
      if (scroller) {
        scroller.addEventListener('scroll', updateMenuPosition, { passive: true })
      }
      window.addEventListener('resize', updateMenuPosition)
      
      return () => {
        cancelAnimationFrame(handle)
        if (scroller) {
          scroller.removeEventListener('scroll', updateMenuPosition)
        }
        window.removeEventListener('resize', updateMenuPosition)
      }
    }
  }, [isMenuOpen, updateMenuPosition])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  const handleSelectDay = (day: string) => {
    onSelect(day)
    setIsMenuOpen(false)
  }

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1))
  }

  if (days.length === 0) {
    return null
  }

  return (
    <div className={styles.dayRail} ref={menuRef}>
      <div className={styles.timelineScroller} ref={scrollerRef}>
        {weekDays.map(({ day, hasData }) => {
          const isActive = day === selectedDate

          return (
            <button
              key={day}
              type="button"
              disabled={!hasData}
              onClick={() => handleSelectDay(day)}
              className={[
                styles.timelinePill,
                isActive ? styles.timelinePillActive : '',
                !hasData ? styles.timelinePillDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isActive}
              title={hasData ? formatFullDateLabel(day) : `${formatFullDateLabel(day)} · 暂无记录`}
            >
              <span className={styles.timelinePillLabel}>{formatWeekdayLabel(day)}</span>
              <span className={styles.timelinePillDate}>{formatCompactDateLabel(day)}</span>
            </button>
          )
        })}

        <div className={styles.dayMenuWrap}>
          <button
            ref={buttonRef}
            type="button"
            className={[
              styles.timelinePill,
              styles.timelinePillMore,
              isMenuOpen ? styles.timelinePillActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setIsMenuOpen((current) => !current)}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
          >
            <span className={styles.timelinePillLabel}>全部日期</span>
            <span className={styles.timelinePillDate}>{days.length} 天记录</span>
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div 
          className={styles.dayMenu} 
          role="dialog" 
          aria-label="日期选择器" 
          ref={menuContentRef}
          style={menuStyle}
        >
          <header className={styles.calendarHeader}>
            <h4 className={styles.calendarTitle}>
              {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
            </h4>
            <div className={styles.calendarNav}>
              <button 
                type="button" 
                className={styles.calendarNavBtn} 
                onClick={() => changeMonth(-1)}
                aria-label="上个月"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                type="button" 
                className={styles.calendarNavBtn} 
                onClick={() => changeMonth(1)}
                aria-label="下个月"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </header>

          <div className={styles.calendarGrid}>
            {['日', '一', '二', '三', '四', '五', '六'].map(w => (
              <span key={w} className={styles.calendarWeekday}>{w}</span>
            ))}
            {calendarGrid.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={!item.hasData}
                onClick={() => handleSelectDay(item.key)}
                className={[
                  styles.calendarDay,
                  !item.isCurrentMonth ? styles.calendarDayOutside : '',
                  item.hasData ? styles.calendarDayHasData : '',
                  item.isActive ? styles.calendarDayActive : '',
                  item.isToday ? styles.calendarDayToday : '',
                ].filter(Boolean).join(' ')}
              >
                {item.date.getDate()}
              </button>
            ))}
          </div>

          <footer className={styles.calendarFooter}>
            <div className={styles.calendarLegend}>
              <span className={styles.calendarLegendDot} />
              <span>有数据</span>
            </div>
          </footer>
        </div>
      ) : null}
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

export default function SpotifyRecentlyPlayedDeck({
  initialAvailableDays = [],
  initialHistoryDate = null,
  initialHistoryTracks = [],
  items,
  view: controlledView,
  onViewChange,
}: {
  initialAvailableDays?: string[]
  initialHistoryDate?: string | null
  initialHistoryTracks?: SpotifyRecentlyPlayedTrack[]
  items: SpotifyRecentlyPlayedTrack[]
  view?: RecentlyPlayedView
  onViewChange?: (view: RecentlyPlayedView) => void
}) {
  const [uncontrolledView, setUncontrolledView] = useState<RecentlyPlayedView>('timeline')
  const [selectedDate, setSelectedDate] = useState<string | null>(initialHistoryDate)
  const [selectedSegment, setSelectedSegment] = useState<TimeSegmentId | null>(null)
  const [historyTracks, setHistoryTracks] = useState<SpotifyRecentlyPlayedTrack[]>(initialHistoryTracks)
  const [isLoading, setIsLoading] = useState(false)
  const [tagStore, setTagStore] = useState<SpotifyTrackTagStore | null>(null)
  const [cardsPerPage, setCardsPerPage] = useState(DEFAULT_CARDS_PER_PAGE)
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const didHydrateInitialDateRef = useRef(Boolean(initialHistoryDate))
  const dateTracksCacheRef = useRef(
    new Map<string, SpotifyRecentlyPlayedTrack[]>(
      initialHistoryDate ? [[initialHistoryDate, initialHistoryTracks]] : []
    )
  )
  const tagStoreCacheRef = useRef(new Map<string, SpotifyTrackTagStore>())
  const view = controlledView ?? uncontrolledView
  const availableDays = initialAvailableDays

  const setView = (nextView: RecentlyPlayedView) => {
    if (onViewChange) {
      onViewChange(nextView)
      return
    }

    setUncontrolledView(nextView)
  }

  useEffect(() => {
    const updateCardsPerPage = () => {
      setCardsPerPage(resolveCardsPerPage(window.innerWidth))
    }

    updateCardsPerPage()
    window.addEventListener('resize', updateCardsPerPage)
    return () => window.removeEventListener('resize', updateCardsPerPage)
  }, [])

  useEffect(() => {
    if (!selectedDate) {
      return
    }

    const date = selectedDate

    if (didHydrateInitialDateRef.current && date === initialHistoryDate) {
      didHydrateInitialDateRef.current = false
      return
    }

    const cachedTracks = dateTracksCacheRef.current.get(date)
    if (cachedTracks) {
      startTransition(() => {
        setHistoryTracks(cachedTracks)
      })
      return
    }

    const controller = new AbortController()

    async function loadHistoryTracks() {
      setIsLoading(true)

      try {
        const params = new URLSearchParams({ date })
        const nextTracks = await readJson<SpotifyRecentlyPlayedTrack[]>(
          `/api/spotify/history?${params.toString()}`,
          controller.signal
        )

        dateTracksCacheRef.current.set(date, nextTracks)
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
  }, [initialHistoryDate, selectedDate])

  const effectiveTracks = selectedDate ? historyTracks : items
  const effectiveSegmentMap = useMemo(() => segmentTracksByTime(effectiveTracks), [effectiveTracks])
  const effectiveHourMap = useMemo(() => groupTracksByHour(effectiveTracks), [effectiveTracks])
  const trackIds = useMemo(
    () => Array.from(new Set(effectiveTracks.map((track) => track.id))),
    [effectiveTracks]
  )
  const tagRequestKey = trackIds.join(',')

  useEffect(() => {
    if (view !== 'chart') {
      return
    }

    if (trackIds.length === 0) {
      setTagStore(null)
      return
    }

    const cachedStore = tagStoreCacheRef.current.get(tagRequestKey)
    if (cachedStore) {
      setTagStore(cachedStore)
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({ ids: tagRequestKey })
    setTagStore(null)

    readJson<SpotifyTrackTagStore>(`/api/spotify/tags?${params.toString()}`, controller.signal)
      .then((nextStore) => {
        tagStoreCacheRef.current.set(tagRequestKey, nextStore)
        setTagStore(nextStore)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTagStore(null)
        }
      })

    return () => {
      controller.abort()
    }
  }, [tagRequestKey, trackIds, view])

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

          <div
            className={styles.statusBar}
            style={{
              opacity: hasMultipleGroups ? 1 : 0,
              visibility: hasMultipleGroups ? 'visible' : 'hidden',
              pointerEvents: hasMultipleGroups ? 'auto' : 'none',
            }}
          >
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

            <div className={styles.timelineMeta}>
              <TimeSegmentSelector
                segmentMap={effectiveSegmentMap}
                selectedSegment={selectedSegment}
                onSelect={handleSelectSegment}
              />
              <HistoryDaySelector days={availableDays} selectedDate={selectedDate} onSelect={handleSelectDay} />
            </div>
        </>
      ) : view === 'chart' ? (
          <div className={styles.chartPanel}>
            <SpotifyListeningChart
              hourMap={effectiveHourMap}
              tagStore={tagStore}
              selectedSegment={selectedSegment}
              onSelectSegment={handleSelectChartSegment}
              isLoading={isLoading}
            />
            <HistoryDaySelector days={availableDays} selectedDate={selectedDate} onSelect={handleSelectDay} />
            <p className={styles.helperText}>
              点击柱状图可跳回时间轴对应时段。{selectedDate ? `当前日期：${activeDayLabel}。` : ''}
            </p>
          </div>
      ) : (
        <SpotifyTagStreamChart />
      )}
    </div>
  )
}
