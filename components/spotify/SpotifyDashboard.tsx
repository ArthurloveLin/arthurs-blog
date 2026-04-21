import { memo, type ReactNode } from 'react'
import Image from 'next/image'
import { AlertTriangle, CalendarClock, Heart, Library, Music2, Users2 } from 'lucide-react'


import type {
  SpotifyDashboardData,
  SpotifyPlaylistPreview,
  SpotifySavedAlbum,
} from '@/lib/spotify-types'
import { formatStableDate } from '@/lib/date-format'
import SpotifyFollowedArtistsPanel from './SpotifyFollowedArtistsPanel'
import SpotifyLivePlayerPanel from './SpotifyLivePlayerPanel'
import SpotifyPlaylistDetail from './SpotifyPlaylistDetail'
import SpotifyRecentlyPlayedDeck from './SpotifyRecentlyPlayedDeck'
import SpotifySavedTracksPanel from './SpotifySavedTracksPanel'
import SpotifyTopArtistsPanel from './SpotifyTopArtistsPanel'
import SpotifyTopTracksPanel from './SpotifyTopTracksPanel'

function formatLocalDateTime(iso: string) {
  return formatStableDate(iso, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}



const SectionCard = memo(function SectionCard({
  eyebrow,
  title,
  description,
  id,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-6 shadow-[0_18px_60_rgba(0,0,0,0.05)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
})

const Artwork = memo(function Artwork({ src, alt, rounded = 'rounded-2xl' }: { src: string | null; alt: string; rounded?: string }) {
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
})

const SavedAlbumsGrid = memo(function SavedAlbumsGrid({ items, total }: { items: SpotifySavedAlbum[]; total: number }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>展示最近收藏的 {items.length} 张专辑</span>
        <span>总量 {total}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <div key={`${item.album.id}-${item.addedAt}-${index}`} className="rounded-[22px] border border-border/60 bg-background/75 p-3">
            <div className="relative aspect-square overflow-hidden rounded-[20px] bg-muted">
              <Artwork src={item.album.imageUrl} alt={item.album.name} />
            </div>
            <div className="mt-3">
              <p className="truncate text-sm font-semibold text-foreground">{item.album.name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.album.artists.join(', ')}</p>
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <p>添加于：{formatLocalDateTime(item.addedAt)}</p>
                <p>{item.album.releaseDate ? `发行于 ${item.album.releaseDate}` : '发行时间未知'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})


const PlaylistsBoard = memo(function PlaylistsBoard({ items, total }: { items: SpotifyPlaylistPreview[]; total: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>已同步 {items.length} 个歌单，支持按需加载完整曲目列表</span>
        <span>总量 {total}</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
          当前账户没有可展示的歌单。
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((playlist) => (
            <SpotifyPlaylistDetail key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}
    </div>
  )
})


export default function SpotifyDashboard({ data }: { data: SpotifyDashboardData }) {
  const overviewCards = [
    {
      label: 'Recently Played',
      value: data.recentlyPlayed.length,
      note: '',
      icon: CalendarClock,
    },
    {
      label: 'Liked Songs',
      value: data.library.savedTracks.total,
      note: '',
      icon: Heart,
    },
    {
      label: 'Followed Artists',
      value: data.library.followedArtists.total,
      note: '',
      icon: Users2,
    },
    {
      label: 'Playlists',
      value: data.library.playlists.total,
      note: '',
      icon: Library,
    },
  ]

  return (
    <div className="site-shell py-10 pb-24">
      <div className="rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.05),transparent_34%)] p-5 sm:p-6">
        <SpotifyLivePlayerPanel />


        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => {
            const Icon = card.icon

            return (
              <div key={card.label} className="rounded-[24px] border border-border/60 bg-card/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{card.label}</p>
                  <Icon className="h-4 w-4 text-emerald-600" strokeWidth={1.8} />
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{card.value.toLocaleString()}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.note}</p>
              </div>
            )
          })}
        </div>
      </div>

      <section id="recently-played" className="mt-6 scroll-mt-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Recently Played</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">最近播放记录</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">第一组展示最近收听的几首，悬停卡片可查看艺人、时间和播放来源。</p>
        <div className="mt-6">
          <SpotifyRecentlyPlayedDeck items={data.recentlyPlayed} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SpotifyTopTracksPanel data={data.topTracks} />
        <SpotifyTopArtistsPanel data={data.topArtists} />
      </div>

      <div id="library" className="mt-6 grid gap-6 xl:grid-cols-2">
        <SpotifySavedTracksPanel
          initialItems={data.library.savedTracks.items}
          total={data.library.savedTracks.total}
        />
        <SpotifyFollowedArtistsPanel
          initialItems={data.library.followedArtists.items}
          total={data.library.followedArtists.total}
        />
      </div>

      <div className="mt-6">
        <SectionCard
          eyebrow="Saved Albums"
          title="已收藏的专辑"
          description="收藏的完整音乐专辑。"
        >
          <SavedAlbumsGrid items={data.library.savedAlbums.items} total={data.library.savedAlbums.total} />
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          eyebrow="Playlists"
          title="用户歌单"
          description="保存的个人及推荐歌单。"
        >
          <PlaylistsBoard items={data.library.playlists.items} total={data.library.playlists.total} />
        </SectionCard>
      </div>

      {data.warnings.length > 0 ? (
        <SectionCard
          eyebrow="Data Warnings"
          title="部分数据暂时不可用"
          description="如果某些接口临时超时或 Spotify 返回异常，下面会列出降级项。"
        >
          <div className="space-y-3">
            {data.warnings.map((warning) => (
              <div key={warning} className="flex items-center gap-3 rounded-[20px] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-foreground/85">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.8} />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}