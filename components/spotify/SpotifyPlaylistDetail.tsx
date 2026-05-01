'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Music2, Loader2 } from 'lucide-react'
import Image from 'next/image'

import type { SpotifyPlaylistPreview, SpotifyPlaylistTrack } from '@/lib/spotify-types'
import { spotifyImg } from '@/lib/spotify-img'
import { getSpotifyPublicApiUrl } from '@/lib/spotify-public-api'
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

export default function SpotifyPlaylistDetail({ playlist }: { playlist: SpotifyPlaylistPreview }) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: tracks = [], error, isLoading } = useSWR<SpotifyPlaylistTrack[]>(
    isOpen ? getSpotifyPublicApiUrl(`/api/spotify/playlists/${playlist.id}`) : null,
    fetchPlaylistTracks,
    {
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      dedupingInterval: 60 * 60 * 1000,
    }
  )

  const errorMessage = error instanceof Error ? error.message : null

  return (
    <details 
      className="group rounded-[24px] border border-border/60 bg-background/75 p-4"
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[22px] bg-muted">
              <Artwork src={spotifyImg(playlist.imageUrl)} alt={playlist.name} />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-base font-semibold text-foreground">{playlist.name}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {playlist.ownerName ? `Owner ${playlist.ownerName}` : 'Owner 未知'}
              </p>
              {playlist.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/75 truncate">{playlist.description}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">{playlist.totalTracks} tracks</span>
            <span className="rounded-full bg-muted px-3 py-1">{playlist.isPublic ? 'Public' : 'Private / Collaborative'}</span>
          </div>
        </div>
      </summary>

      <div className="mt-4 border-t border-border/60 pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="ml-3 text-sm text-muted-foreground">加载曲目列表中...</span>
          </div>
        ) : errorMessage ? (
          <div className="py-4 text-center text-sm text-destructive">{errorMessage}</div>
        ) : (
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
              {tracks.length === 0 && !isLoading && (
                <p className="py-10 text-center text-sm text-muted-foreground">暂无曲目数据</p>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
