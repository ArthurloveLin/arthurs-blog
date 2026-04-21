'use client'

import React, { useMemo, useTransition } from 'react'
import Image from 'next/image'
import { ExternalLink, Mic2, Users } from 'lucide-react'

import type { SpotifyTimeRange, SpotifyTopArtist } from '@/lib/spotify-types'

const RANGE_LABELS: Record<SpotifyTimeRange, string> = {
  short_term: '近 4 周',
  medium_term: '近 6 个月',
  long_term: '历史全部',
}

export default function SpotifyTopArtistsPanel({
  data,
}: {
  data: Record<SpotifyTimeRange, SpotifyTopArtist[]>
}) {
  const [isPending, startTransition] = useTransition()
  const [activeRange, setActiveRange] = React.useState<SpotifyTimeRange>('medium_term')

  const activeItems = useMemo(() => data[activeRange] ?? [], [activeRange, data])

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Top Artists</p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">最爱歌手排行</h3>
            
            <div className="hidden sm:inline-flex flex-nowrap gap-1 rounded-full border border-border/70 bg-background/80 p-0.5 shrink-0">
              {(Object.keys(RANGE_LABELS) as SpotifyTimeRange[]).map((range) => {
                const isActive = range === activeRange

                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        setActiveRange(range)
                      })
                    }}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                      isActive
                        ? 'bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.12)]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {RANGE_LABELS[range]}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            基于收听频率自动生成的歌手排行榜。
          </p>
        </div>

        {/* Mobile buttons */}
        <div className="sm:hidden inline-flex flex-nowrap gap-1 overflow-x-auto scrollbar-none rounded-full border border-border/70 bg-background/80 p-0.5">
          {(Object.keys(RANGE_LABELS) as SpotifyTimeRange[]).map((range) => {
            const isActive = range === activeRange

            return (
              <button
                key={`${range}-mobile`}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setActiveRange(range)
                  })
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  isActive
                    ? 'bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.12)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {RANGE_LABELS[range]}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`mt-6 max-h-[860px] overflow-y-auto scrollbar-none transition ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        {activeItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
            当前时间跨度没有返回可展示的 Top Artists 数据。
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeItems.map((artist) => (
              <div
                key={`${activeRange}-${artist.id}-${artist.rank}`}
                className="rounded-[22px] border border-border/60 bg-background/75 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted">
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
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">#{artist.rank}</p>
                        <h4 className="truncate text-base font-semibold text-foreground">{artist.name}</h4>
                      </div>
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
                          {artist.followers.toLocaleString()} followers
                        </span>
                      ) : null}
                      {artist.popularity !== null ? (
                        <span className="rounded-full bg-muted px-2.5 py-1">Popularity {artist.popularity}</span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {artist.genres.length > 0 ? (
                        artist.genres.slice(0, 5).map((genre) => (
                          <span key={genre} className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-foreground/80">
                            {genre}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">该歌手未返回 genres 标签</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}