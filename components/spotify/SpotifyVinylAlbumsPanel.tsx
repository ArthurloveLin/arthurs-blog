'use client'

import { ViewTransition, addTransitionType, startTransition, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react'

import type { SpotifySectionCopy } from '@/lib/spotify-page-copy'
import type { SpotifySavedAlbum } from '@/lib/spotify-types'
import { formatStableDate } from '@/lib/date-format'
import styles from './SpotifyVinylAlbumsPanel.module.css'

const DEFAULT_PAGE_SIZE = 6

function resolvePageSize(width: number) {
  if (width < 640) return 1
  if (width < 900) return 4
  return 6
}

function chunk<T>(arr: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    groups.push(arr.slice(i, i + size))
  }
  return groups
}

function VinylAlbum({ album, addedAt }: { album: SpotifySavedAlbum['album']; addedAt: string }) {
  const addedAtFormatted = formatStableDate(addedAt, { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className={styles.albumItem}>
      <div className={styles.album}>
        <div className={styles.cover}>
          {album.imageUrl ? (
            <Image src={album.imageUrl} alt={album.name} fill sizes="200px" className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <Music2 className="h-8 w-8" strokeWidth={1.6} />
            </div>
          )}
        </div>
        <div className={styles.vinyl}>
          <div
            className={styles.vinylCover}
            style={album.imageUrl ? { backgroundImage: `url(${album.imageUrl})` } : undefined}
          />
        </div>
      </div>
      <div className={styles.albumInfo}>
        <p className={styles.albumName}>{album.name}</p>
        <p className={styles.albumArtist}>{album.artists.join(', ')}</p>
        {album.releaseDate ? <p className={styles.albumDate}>发行 {album.releaseDate.replace(/-/g, '/')}</p> : null}
        <p className={styles.albumDate}>收藏 {addedAtFormatted}</p>
      </div>
    </div>
  )
}

export default function SpotifyVinylAlbumsPanel({
  items,
  total,
  copy,
}: {
  items: SpotifySavedAlbum[]
  total: number
  copy: SpotifySectionCopy
}) {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const update = () => setPageSize(resolvePageSize(window.innerWidth))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const pages = chunk(items, pageSize)
  const effectivePage = Math.min(page, Math.max(pages.length - 1, 0))
  const currentItems = pages[effectivePage] ?? []
  const hasMultiple = pages.length > 1

  const rangeStart = effectivePage * pageSize + 1
  const rangeEnd = Math.min((effectivePage + 1) * pageSize, items.length)
  const rangeLabel = pageSize === 1
    ? `当前第 ${rangeStart} 张`
    : `当前第 ${rangeStart} - ${rangeEnd} 张`

  return (
    <section className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60_rgba(0,0,0,0.05)] overflow-visible">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{copy.eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {copy.description} {items.length > 0 ? `${rangeLabel}，共 ${total} 张。` : ''}
      </p>

      {items.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
          当前没有可展示的已收藏专辑。
        </div>
      ) : (
        <div className="mt-6">
          <div className={styles.viewport}>
            {hasMultiple ? (
              <>
                <button
                  type="button"
                  className={[styles.navButton, styles.navButtonLeft].join(' ')}
                  onClick={() => startTransition(() => {
                    addTransitionType('vinyl-page-prev')
                    setPage((p) => Math.max(0, p - 1))
                  })}
                  disabled={effectivePage === 0}
                  aria-label="查看上一组专辑"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={[styles.navButton, styles.navButtonRight].join(' ')}
                  onClick={() => startTransition(() => {
                    addTransitionType('vinyl-page-next')
                    setPage((p) => Math.min(pages.length - 1, p + 1))
                  })}
                  disabled={effectivePage === pages.length - 1}
                  aria-label="查看下一组专辑"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </>
            ) : null}

            <ViewTransition
              key={`vinyl-${pageSize}-${effectivePage}`}
              enter={{ 'vinyl-page-next': 'vinyl-slide-from-right', 'vinyl-page-prev': 'vinyl-slide-from-left', default: 'none' }}
              exit={{ 'vinyl-page-next': 'vinyl-slide-to-left', 'vinyl-page-prev': 'vinyl-slide-to-right', default: 'none' }}
              default="none"
            >
              <div className={styles.albumGrid}>
                {currentItems.map(({ album, addedAt }) => (
                  <VinylAlbum key={album.id} album={album} addedAt={addedAt} />
                ))}
              </div>
            </ViewTransition>
          </div>

          {hasMultiple ? (
            <div className={styles.statusBar}>
              <div className={styles.paginationDots} aria-hidden="true">
                {pages.map((_, i) => (
                  <span
                    key={`vinyl-dot-${i}`}
                    className={[
                      styles.paginationDot,
                      i === effectivePage ? styles.paginationDotActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                ))}
              </div>
              <p className={styles.pageLabel}>第 {effectivePage + 1} 组 / 共 {pages.length} 组</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
