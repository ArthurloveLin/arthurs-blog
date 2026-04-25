'use client'

import { useMemo, useState, useTransition } from 'react'

import type { SpotifyTimeRange, SpotifyTopTrack } from '@/lib/spotify-types'
import SpotifyTrackWall from './SpotifyTrackWall'
import SpotifyTimeRangeTabs from './SpotifyTimeRangeTabs'

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const RANGE_DESCRIPTIONS: Record<SpotifyTimeRange, string> = {
  short_term: '近 4 周',
  medium_term: '近 6 个月',
  long_term: '历史全部',
}

function formatTotalDuration(items: SpotifyTopTrack[]) {
  const totalMinutes = Math.floor(items.reduce((sum, track) => sum + track.durationMs, 0) / 60000)
  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

export default function SpotifyTopTracksPanel({
  data,
}: {
  data: Record<SpotifyTimeRange, SpotifyTopTrack[]>
}) {
  const [isPending, startTransition] = useTransition()
  const [activeRange, setActiveRange] = useState<SpotifyTimeRange>('medium_term')

  const activeItems = useMemo(() => data[activeRange] ?? [], [activeRange, data])
  const wallItems = useMemo(
    () =>
      activeItems.map((track) => ({
        id: `${activeRange}-${track.id}-${track.rank}`,
        order: track.rank,
        title: track.title,
        artists: track.artists.join(', '),
        album: track.album,
        imageUrl: track.albumImageUrl,
        href: track.songUrl,
        meta: [formatDuration(track.durationMs)],
      })),
    [activeRange, activeItems]
  )
  const footerStats = useMemo(
    () => [
      { label: 'tracks', value: `${activeItems.length}` },
      { label: 'window', value: RANGE_DESCRIPTIONS[activeRange] },
      { label: 'duration', value: formatTotalDuration(activeItems) },
    ],
    [activeItems, activeRange]
  )

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
            基于收听频率自动生成的单曲排行榜，会完整展示 50 首；可以用方向按钮手动移动视口探索更多封面。
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

      <div className={`mt-6 transition ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        {activeItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
            当前时间跨度没有返回可展示的 Top Tracks 数据。
          </div>
        ) : (
          <SpotifyTrackWall
            items={wallItems}
            emptyMessage="当前时间跨度没有返回可展示的 Top Tracks 数据。"
            footerStats={footerStats}
          />
        )}
      </div>
    </section>
  )
}