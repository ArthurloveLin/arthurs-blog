'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Mic2, Users } from 'lucide-react'

import type { SpotifySectionCopy } from '@/lib/spotify-page-copy'
import type { SpotifyTimeRange, SpotifyTopArtist } from '@/lib/spotify-types'
import SpotifyTimeRangeTabs from './SpotifyTimeRangeTabs'
import styles from './SpotifyTopArtistsPanel.module.css'

function chunkArtists(arr: SpotifyTopArtist[], size: number): SpotifyTopArtist[][] {
  const groups: SpotifyTopArtist[][] = []
  for (let i = 0; i < arr.length; i += size) {
    groups.push(arr.slice(i, i + size))
  }
  return groups
}

function useCardsPerPage() {
  const [cardsPerPage, setCardsPerPage] = useState(4)

  useEffect(() => {
    const resolve = () => {
      if (window.matchMedia('(max-width: 639px)').matches) return 2
      if (window.matchMedia('(max-width: 1023px)').matches) return 3
      return 4
    }

    const update = () => setCardsPerPage(resolve())
    update()

    const mql = window.matchMedia('(max-width: 639px), (max-width: 1023px)')
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return cardsPerPage
}

function ArtistCard({ artist }: { artist: SpotifyTopArtist }) {
  const hasImage = Boolean(artist.imageUrl)

  return (
    <div
      className={styles.card}
      style={hasImage ? { backgroundImage: `url(${artist.imageUrl})` } : undefined}
      data-no-image={!hasImage ? 'true' : undefined}
    >
      {!hasImage && (
        <div className={styles.fallbackIcon}>
          <Mic2 className="h-10 w-10" strokeWidth={1.5} />
        </div>
      )}

      {/* Gradient shade — always present */}
      <div className={styles.shade} />

      {/* Inner border (CodePen .border equivalent) */}
      <div className={styles.innerBorder} />

      {/* Rank — always visible */}
      <span className={styles.rankLabel}>#{artist.rank}</span>

      {/* Hover-revealed content */}
      <div className={styles.hoverContent}>
        <div className={styles.nameRow}>
          <h4 className={styles.artistName}>{artist.name}</h4>
          {artist.url ? (
            <a
              href={artist.url}
              target="_blank"
              rel="noreferrer"
              className={styles.externalLink}
              aria-label={`在 Spotify 上查看 ${artist.name}`}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
            </a>
          ) : null}
        </div>

        <div className={styles.metaGroup}>
          {artist.followers ? (
            <p className={styles.metaRow}>
              <Users className="h-3 w-3 shrink-0" strokeWidth={1.8} />
              {artist.followers.toLocaleString()} followers
            </p>
          ) : null}
          {artist.popularity !== null ? (
            <p className={styles.metaRow}>Popularity {artist.popularity}</p>
          ) : null}
          {artist.genres.length > 0 ? (
            <div className={styles.genreTags}>
              {artist.genres.slice(0, 3).map((genre) => (
                <span key={genre} className={styles.genreTag}>{genre}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function SpotifyTopArtistsPanel({
  data,
  copy,
}: {
  data: Record<SpotifyTimeRange, SpotifyTopArtist[]>
  copy: SpotifySectionCopy
}) {
  const [isPending, startTransition] = useTransition()
  const [activeRange, setActiveRange] = React.useState<SpotifyTimeRange>('medium_term')
  const cardsPerPage = useCardsPerPage()

  const activeItems = useMemo(() => data[activeRange] ?? [], [activeRange, data])
  const groups = useMemo(() => chunkArtists(activeItems, cardsPerPage), [activeItems, cardsPerPage])

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{copy.eyebrow}</p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h3>
            <div className="hidden shrink-0 sm:block">
              <SpotifyTimeRangeTabs
                activeRange={activeRange}
                onChange={(range) => {
                  startTransition(() => setActiveRange(range))
                }}
                tone="contrast"
              />
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <div className="sm:hidden">
          <SpotifyTimeRangeTabs
            activeRange={activeRange}
            onChange={(range) => {
              startTransition(() => setActiveRange(range))
            }}
            tone="contrast"
          />
        </div>
      </div>

      <div className={`mt-6 transition-opacity duration-200 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        {activeItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
            当前时间跨度没有返回可展示的 Top Artists 数据。
          </div>
        ) : (
          <TopArtistsPager
            key={`${activeRange}-${cardsPerPage}`}
            activeRange={activeRange}
            cardsPerPage={cardsPerPage}
            groups={groups}
          />
        )}
      </div>
    </section>
  )
}

function TopArtistsPager({
  activeRange,
  cardsPerPage,
  groups,
}: {
  activeRange: SpotifyTimeRange
  cardsPerPage: number
  groups: SpotifyTopArtist[][]
}) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const effectiveIndex = Math.min(currentGroupIndex, Math.max(0, groups.length - 1))
  const currentGroup = groups[effectiveIndex] ?? []
  const hasMultipleGroups = groups.length > 1

  const handlePrevious = () => {
    setCurrentGroupIndex(Math.max(0, effectiveIndex - 1))
  }

  const handleNext = () => {
    setCurrentGroupIndex(Math.min(groups.length - 1, effectiveIndex + 1))
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
              disabled={effectiveIndex === 0}
              aria-label="查看上一组歌手"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={[styles.navButton, styles.navButtonRight].join(' ')}
              onClick={handleNext}
              disabled={effectiveIndex === groups.length - 1}
              aria-label="查看下一组歌手"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </>
        ) : null}

        <div
          key={`${activeRange}-${cardsPerPage}-${effectiveIndex}`}
          className={[styles.grid, 'animate-in fade-in slide-in-from-right-4 duration-500'].join(' ')}
          style={{ gridTemplateColumns: `repeat(${cardsPerPage}, minmax(0, 1fr))` }}
        >
          {currentGroup.map((artist) => (
            <ArtistCard key={`${activeRange}-${artist.id}-${artist.rank}`} artist={artist} />
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
                key={`artist-dot-${index}`}
                className={[
                  styles.paginationDot,
                  index === effectiveIndex ? styles.paginationDotActive : '',
                ].filter(Boolean).join(' ')}
              />
            ))}
          </div>
          <p className={styles.pageLabel}>
            第 {effectiveIndex + 1} 组 / 共 {groups.length} 组
          </p>
        </div>
      ) : null}
    </div>
  )
}
