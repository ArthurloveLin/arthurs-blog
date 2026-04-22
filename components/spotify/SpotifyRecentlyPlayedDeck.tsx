'use client'

import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react'

import type { SpotifyRecentlyPlayedTrack } from '@/lib/spotify-types'
import { formatStableDate } from '@/lib/date-format'

import styles from './SpotifyRecentlyPlayedDeck.module.css'

const DEFAULT_CARDS_PER_PAGE = 4

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

  const groups = useMemo(() => chunkItems(items, cardsPerPage), [items, cardsPerPage])

  if (items.length === 0) {
    return <div className={styles.emptyState}>当前没有可展示的 Recently Played 数据。</div>
  }

  const effectiveGroupIndex = Math.min(currentGroupIndex, Math.max(groups.length - 1, 0))
  const currentGroup = groups[effectiveGroupIndex] ?? []
  const hasMultipleGroups = groups.length > 1

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

  return (
    <div className={styles.section}>
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
          key={`${cardsPerPage}-${effectiveGroupIndex}`}
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
            第 {effectiveGroupIndex + 1} 组 / 共 {groups.length} 组
          </p>
        </div>
      ) : null}
    </div>
  )
}