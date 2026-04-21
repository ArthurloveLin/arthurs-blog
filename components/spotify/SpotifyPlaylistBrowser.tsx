'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { ChevronRight, Globe2, Lock, Music2, UserRound } from 'lucide-react'

import type { SpotifyPlaylistPreview } from '@/lib/spotify-types'
import SpotifyPlaylistDetail from './SpotifyPlaylistDetail'

function PlaylistArtwork({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground rounded-[18px]">
        <Music2 className="h-5 w-5" strokeWidth={1.8} />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 72px, 88px"
      className="object-cover rounded-[18px]"
      unoptimized
    />
  )
}

export default function SpotifyPlaylistBrowser({
  items,
  total,
}: {
  items: SpotifyPlaylistPreview[]
  total: number
}) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)

  const selectedPlaylist = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  )

  if (items.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
        当前账户没有可展示的歌单。
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
        <span>已同步 {items.length} 个歌单，先从目录挑选，再查看完整曲目列表。</span>
        <span>总量 {total}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((playlist) => {
          const isSelected = playlist.id === selectedPlaylist?.id

          return (
            <button
              key={playlist.id}
              type="button"
              onClick={() => setSelectedId(playlist.id)}
              className={`text-left rounded-[24px] border p-3 transition ${
                isSelected
                  ? 'border-emerald-500/30 bg-emerald-500/6 shadow-[0_16px_36px_rgba(16,185,129,0.10)]'
                  : 'border-border/60 bg-background/75 hover:border-foreground/20 hover:bg-background'
              }`}
            >
              <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
                <div className="relative aspect-square overflow-hidden rounded-[18px] bg-muted">
                  <PlaylistArtwork src={playlist.imageUrl} alt={playlist.name} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-foreground">{playlist.name}</h4>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {playlist.ownerName ?? '未知创建者'}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition ${isSelected ? 'text-emerald-600' : 'text-muted-foreground'}`} strokeWidth={1.8} />
                  </div>

                  {playlist.description ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/70">{playlist.description}</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">没有额外描述，作为目录入口展示。</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-1">{playlist.totalTracks} 首</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      {playlist.isPublic ? <Globe2 className="h-3.5 w-3.5" strokeWidth={1.8} /> : <Lock className="h-3.5 w-3.5" strokeWidth={1.8} />}
                      {playlist.isPublic ? '公开' : '私有 / 协作'}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selectedPlaylist ? <SpotifyPlaylistDetail playlist={selectedPlaylist} forceOpen showSummary={false} /> : null}
    </div>
  )
}