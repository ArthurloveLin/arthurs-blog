'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { Clock3, ExternalLink, Music2 } from 'lucide-react'

import type { SpotifyTimeRange, SpotifyTopTrack } from '@/lib/spotify-types'

const RANGE_LABELS: Record<SpotifyTimeRange, string> = {
  short_term: '近 4 周',
  medium_term: '近 6 个月',
  long_term: '历史全部',
}

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
    <section className="rounded-[28px] border border-border/60 bg-card/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Top Tracks</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">最爱单曲排行</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            按 Spotify 官方 time_range 拉取前 50 名，保留歌名、歌手、专辑与单曲时长。
          </p>
        </div>

        <div className="inline-flex flex-wrap gap-2 rounded-full border border-border/70 bg-background/80 p-1">
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
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {RANGE_LABELS[range]}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`mt-6 max-h-[860px] overflow-y-auto pr-1 transition ${isPending ? 'opacity-60' : 'opacity-100'}`}>
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