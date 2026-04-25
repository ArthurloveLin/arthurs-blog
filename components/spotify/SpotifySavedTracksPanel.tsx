'use client'

import { useEffect, useMemo } from 'react'

import type { SpotifySavedTrack } from '@/lib/spotify-types'
import { formatStableDate } from '@/lib/date-format'
import SpotifyTrackWall from './SpotifyTrackWall'
import { useSpotifyCollectionPagination } from './useSpotifyCollectionPagination'

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

const PAGE_SIZE = 24

function buildTracksResetKey(items: SpotifySavedTrack[], total: number) {
  return `${total}:${items.map((item) => `${item.track.id}:${item.addedAt}`).join('|')}`
}

export default function SpotifySavedTracksPanel({
  initialItems,
  total,
}: {
  initialItems: SpotifySavedTrack[]
  total: number
}) {
  const resetKey = buildTracksResetKey(initialItems, total)

  return <SpotifySavedTracksPanelContent key={resetKey} initialItems={initialItems} total={total} />
}

function SpotifySavedTracksPanelContent({
  initialItems,
  total,
}: {
  initialItems: SpotifySavedTrack[]
  total: number
}) {
  const { error, hasMore, isLoading, loadMore, visibleItems } = useSpotifyCollectionPagination({
    initialItems,
    total,
    pageSize: PAGE_SIZE,
    fetchUrl: '/api/spotify/library/tracks',
    getItemKey: (item) => `${item.track.id}:${item.addedAt}`,
  })

  useEffect(() => {
    if (error) {
      console.error('Failed to fetch more tracks:', error)
    }
  }, [error])

  const wallItems = useMemo(
    () =>
      visibleItems.map((item, index) => ({
        id: `${item.track.id}:${item.addedAt}`,
        order: index + 1,
        title: item.track.title,
        artists: item.track.artists.join(', '),
        album: item.track.album,
        imageUrl: item.track.albumImageUrl,
        href: item.track.songUrl,
        meta: [formatDuration(item.track.durationMs), `添加于 ${formatLocalDateTime(item.addedAt)}`],
      })),
    [visibleItems]
  )
  const footerStats = useMemo(
    () => [
      { label: 'preview', value: `${visibleItems.length}` },
      { label: 'library', value: `${total}` },
      { label: 'next batch', value: hasMore ? `${Math.min(PAGE_SIZE, total - visibleItems.length)}` : 'done' },
    ],
    [hasMore, total, visibleItems.length]
  )

  return (
    <section id="saved-tracks" className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60_rgba(0,0,0,0.05)]">
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
            先显示精简预览批次，默认停在中央封面附近；也可以随时用方向按钮手动移动视口探索更多。
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {error ? (
          <p className="text-sm text-amber-600">加载更多歌曲时出现问题，可以继续重试。</p>
        ) : null}

        <SpotifyTrackWall
          items={wallItems}
          emptyMessage="没有发现已点赞的歌曲。"
          footerStats={footerStats}
          loadMore={hasMore ? {
            hasMore,
            isLoading,
            onLoadMore: loadMore,
            label: isLoading ? '正在加载更多' : `继续展开 ${Math.min(PAGE_SIZE, total - visibleItems.length)} 首`,
          } : undefined}
        />
      </div>
    </section>
  )
}
