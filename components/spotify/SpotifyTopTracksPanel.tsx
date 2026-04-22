'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { Clock3, ExternalLink, Music2 } from 'lucide-react'

import type { SpotifyTimeRange, SpotifyTopTrack } from '@/lib/spotify-types'
import SpotifyTimeRangeTabs from './SpotifyTimeRangeTabs'

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function SpotifyTopTracksPanel({
  data,
}: {
  data: Record<SpotifyTimeRange, SpotifyTopTrack[]>
}) {
  const [isPending, startTransition] = useTransition()
  const [activeRange, setActiveRange] = useState<SpotifyTimeRange>('medium_term')

  const activeItems = useMemo(() => data[activeRange] ?? [], [activeRange, data])

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Top Tracks</p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">最爱单曲排行</h3>
            <div className="hidden shrink-0 sm:block">
              <SpotifyTimeRangeTabs
                activeRange={activeRange}
                onChange={(range) => {
                  startTransition(() => {
                    setActiveRange(range)
                  })
                }}
                tone="emerald"
              />
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            基于收听频率自动生成的单曲排行榜。
          </p>
        </div>

        <div className="sm:hidden">
          <SpotifyTimeRangeTabs
            activeRange={activeRange}
            onChange={(range) => {
              startTransition(() => {
                setActiveRange(range)
              })
            }}
            tone="emerald"
          />
        </div>
      </div>

      <div className={`mt-6 max-h-[860px] overflow-y-auto scrollbar-none transition ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        {activeItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
            当前时间跨度没有返回可展示的 Top Tracks 数据。
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeItems.map((track) => (
              <div
                key={`${activeRange}-${track.id}-${track.rank}`}
                className="grid grid-cols-[40px_56px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border border-border/60 bg-background/75 p-3"
              >
                <div className="text-center font-mono text-sm font-semibold text-muted-foreground">#{track.rank}</div>
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
                  <p className="mt-1 truncate text-xs text-foreground/70">{track.album}</p>
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
            ))}
          </div>
        )}
      </div>
    </section>
  )
}