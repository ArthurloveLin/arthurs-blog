'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, Globe2, Loader2, Lock, Music2, UserRound } from 'lucide-react'
import Image from 'next/image'

import type { SpotifyPlaylistPreview, SpotifyPlaylistTrack } from '@/lib/spotify-types'
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



function Artwork({ src, alt, rounded = 'rounded-2xl' }: { src: string | null; alt: string; rounded?: string }) {
  if (!src) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-muted text-muted-foreground ${rounded}`}>
        <Music2 className="h-5 w-5" strokeWidth={1.8} />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 64px, 72px"
      className={`object-cover ${rounded}`}
      unoptimized
    />
  )
}

async function fetchPlaylistTracks(url: string): Promise<SpotifyPlaylistTrack[]> {
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error('Failed to load tracks')
  }

  return response.json() as Promise<SpotifyPlaylistTrack[]>
}

function PlaylistSummary({ playlist }: { playlist: SpotifyPlaylistPreview }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-4">
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[22px] bg-muted">
          <Artwork src={playlist.imageUrl} alt={playlist.name} />
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold text-foreground">{playlist.name}</h4>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" strokeWidth={1.8} />
            {playlist.ownerName ? `创建者 ${playlist.ownerName}` : '创建者未知'}
          </p>
          {playlist.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/75 md:line-clamp-2">{playlist.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1">{playlist.totalTracks} 首歌曲</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
          {playlist.isPublic ? <Globe2 className="h-3.5 w-3.5" strokeWidth={1.8} /> : <Lock className="h-3.5 w-3.5" strokeWidth={1.8} />}
          {playlist.isPublic ? '公开歌单' : '私有 / 协作'}
        </span>
      </div>
    </div>
  )
}

function PlaylistTracksContent({
  playlist,
  tracks,
  isLoading,
  errorMessage,
}: {
  playlist: SpotifyPlaylistPreview
  tracks: SpotifyPlaylistTrack[]
  isLoading: boolean
  errorMessage: string | null
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        <span className="ml-3 text-sm text-muted-foreground">加载曲目列表中...</span>
      </div>
    )
  }

  if (errorMessage) {
    return <div className="py-4 text-center text-sm text-destructive">{errorMessage}</div>
  }

  return (
    <div className="max-h-[480px] overflow-y-auto pr-1">
      <div className="space-y-2">
        {tracks.map((item, index) => (
          <div key={`${playlist.id}-${item.track.id}-${index}`} className="grid gap-3 rounded-[20px] border border-border/50 bg-card/80 p-3 md:grid-cols-[40px_minmax(0,1fr)_220px] md:items-center">
            <div className="font-mono text-sm text-muted-foreground">#{index + 1}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{item.track.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.track.artists.join(', ')}</p>
              <p className="mt-1 truncate text-xs text-foreground/70">{item.track.album}</p>
            </div>
            <div className="text-xs text-muted-foreground md:text-right">
              {item.addedAt ? <p>添加于：{formatLocalDateTime(item.addedAt)}</p> : <p>添加时间未知</p>}
            </div>
          </div>
        ))}
        {tracks.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">暂无曲目数据</p> : null}
      </div>
    </div>
  )
}

export default function SpotifyPlaylistDetail({
  playlist,
  forceOpen = false,
  showSummary = true,
}: {
  playlist: SpotifyPlaylistPreview
  forceOpen?: boolean
  showSummary?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: tracks = [], error, isLoading } = useSWR<SpotifyPlaylistTrack[]>(
    forceOpen || isOpen ? `/api/spotify/playlists/${playlist.id}` : null,
    fetchPlaylistTracks,
    {
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      dedupingInterval: 60 * 60 * 1000,
    }
  )

  const errorMessage = error instanceof Error ? error.message : null

  const content = (
    <PlaylistTracksContent
      playlist={playlist}
      tracks={tracks}
      isLoading={isLoading}
      errorMessage={errorMessage}
    />
  )

  if (!showSummary) {
    return (
      <section className="rounded-[24px] border border-border/60 bg-background/75 p-4 sm:p-5">
        <PlaylistSummary playlist={playlist} />
        <div className="mt-4 border-t border-border/60 pt-4">{content}</div>
      </section>
    )
  }

  return (
    <details
      className="group rounded-[24px] border border-border/60 bg-background/75 p-4"
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <PlaylistSummary playlist={playlist} />
          </div>
          <span className="hidden items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground md:inline-flex">
            展开曲目
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" strokeWidth={1.8} />
          </span>
        </div>
      </summary>

      <div className="mt-4 border-t border-border/60 pt-4">{content}</div>
    </details>
  )
}
