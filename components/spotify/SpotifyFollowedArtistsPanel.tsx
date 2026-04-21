'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ExternalLink, Mic2, Users, Loader2 } from 'lucide-react'

import type { SpotifyFollowedArtist } from '@/lib/spotify-types'

const PAGE_SIZE = 12

export default function SpotifyFollowedArtistsPanel({
  initialItems,
  total,
}: {
  initialItems: SpotifyFollowedArtist[]
  total: number
}) {
  const [items, setItems] = useState<SpotifyFollowedArtist[]>(initialItems)
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const [fullCollection, setFullCollection] = useState<SpotifyFollowedArtist[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  const hasMore = items.length < total || displayCount < items.length

  const loadMore = useCallback(async () => {
    if (displayCount < items.length) {
      setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, items.length))
      return
    }

    if (!fullCollection && items.length < total) {
      setIsLoading(true)
      try {
        const response = await fetch('/api/spotify/library/artists')
        if (response.ok) {
          const data = await response.json()
          setFullCollection(data)
          setItems(data)
          setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, data.length))
        }
      } catch (error) {
        console.error('Failed to fetch more artists:', error)
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
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Followed Artists</p>
          <div className="mt-1 flex items-center gap-3">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">关注的歌手</h3>
            <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {total} 位
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            关注的音乐创作人。
          </p>
        </div>
      </div>

      <div className="mt-6 max-h-[860px] overflow-y-auto scrollbar-none pr-1">
        {visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            没有发现关注的歌手。
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleItems.map((artist, index) => (
              <div
                key={`${artist.id}-${index}`}
                className="rounded-[22px] border border-border/60 bg-background/75 p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted shrink-0">
                    {artist.imageUrl ? (
                      <Image
                        src={artist.imageUrl}
                        alt={artist.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Mic2 className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="truncate text-base font-semibold text-foreground">{artist.name}</h4>
                      {artist.url ? (
                        <a href={artist.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {artist.followers ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                          <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
                          {artist.followers.toLocaleString()} 关注者
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {artist.genres.slice(0, 3).map((genre) => (
                        <span key={genre} className="rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] text-foreground/70 uppercase">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={observerTarget} className="py-6 flex justify-center">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>载入更多...</span>
            </div>
          ) : hasMore ? (
            <div className="h-4" />
          ) : visibleItems.length > 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">已经看到最后啦</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
