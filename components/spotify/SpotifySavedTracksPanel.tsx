'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Clock3, ExternalLink, Music2, Loader2 } from 'lucide-react'

import type { SpotifySavedTrack } from '@/lib/spotify-types'
import { formatStableDate } from '@/lib/date-format'

function formatLocalDateTime(iso: string) {
  return formatStableDate(iso, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const PAGE_SIZE = 20

export default function SpotifySavedTracksPanel({
  initialItems,
  total,
}: {
  initialItems: SpotifySavedTrack[]
  total: number
}) {
  const [items, setItems] = useState<SpotifySavedTrack[]>(initialItems)
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const [fullCollection, setFullCollection] = useState<SpotifySavedTrack[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  const hasMore = items.length < total || displayCount < items.length

  const loadMore = useCallback(async () => {
    // If we have more items in the current 'items' array that are not yet displayed
    if (displayCount < items.length) {
      setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, items.length))
      return
    }

    // If we need to fetch the full collection from the API
    if (!fullCollection && items.length < total) {
      setIsLoading(true)
      try {
        const response = await fetch('/api/spotify/library/tracks')
        if (response.ok) {
          const data = await response.json()
          setFullCollection(data)
          setItems(data) // The API returns the full list
          setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, data.length))
        }
      } catch (error) {
        console.error('Failed to fetch more tracks:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }, [displayCount, items.length, fullCollection, total])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoading, loadMore])

  const visibleItems = items.slice(0, displayCount)

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)] h-full flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Library Data</p>
          <div className="mt-1 flex items-center gap-3">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">已点赞的歌曲</h3>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
              {total} 首
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            收藏的所有心动曲目。
          </p>
        </div>
      </div>

      <div className="mt-6 max-h-[860px] overflow-y-auto scrollbar-none pr-1">
        {visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            没有发现已点赞的歌曲。
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleItems.map((item, index) => {
              const { track, addedAt } = item
              return (
                <div
                  key={`${track.id}-${addedAt}-${index}`}
                  className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border border-border/60 bg-background/75 p-3"
                >
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-muted">
                    {track.albumImageUrl ? (
                      <Image
                        src={track.albumImageUrl}
                        alt={track.album}
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Music2 className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{track.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{track.artists.join(', ')}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>添加于：{formatLocalDateTime(addedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {formatDuration(track.durationMs)}
                    </span>
                    {track.songUrl ? (
                      <a href={track.songUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-emerald-600">
                        打开
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </a>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div ref={observerTarget} className="py-6 flex justify-center">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>载入更多...</span>
            </div>
          ) : hasMore ? (
            <div className="h-4" /> // Trigger area
          ) : visibleItems.length > 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">已经看到最后啦</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
