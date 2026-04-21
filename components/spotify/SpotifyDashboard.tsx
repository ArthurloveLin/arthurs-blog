import { memo, type ReactNode } from 'react'
import Image from 'next/image'
import { CalendarClock, Heart, Library, Music2, Radio, Users2 } from 'lucide-react'


import type {
  SpotifyDashboardData,
  SpotifyPlaylistPreview,
  SpotifyRecentlyPlayedTrack,
  SpotifySavedAlbum,
} from '@/lib/spotify-types'
import { formatStableDate } from '@/lib/date-format'
import SpotifyFollowedArtistsPanel from './SpotifyFollowedArtistsPanel'
import SpotifyLivePlayerPanel from './SpotifyLivePlayerPanel'
import SpotifyPlaylistBrowser from './SpotifyPlaylistBrowser'
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

const RecentlyPlayedCard = memo(function RecentlyPlayedCard({ item }: { item: SpotifyRecentlyPlayedTrack }) {
  return (
    <article className="rounded-[24px] border border-border/60 bg-background/75 p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[72px_minmax(0,1fr)_auto] md:items-start">
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[22px] bg-muted">
          <Artwork src={item.albumImageUrl} alt={item.album} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-base font-semibold text-foreground">{item.title}</h4>
              <p className="truncate text-sm text-muted-foreground">{item.artists.join(', ')}</p>
            </div>
            {item.songUrl ? (
              <a href={item.songUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:text-emerald-500">
                Spotify
              </a>
            ) : null}
          </div>

          <p className="mt-2 truncate text-sm text-foreground/80">{item.album}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted/70 px-3 py-1">播放于 {formatLocalDateTime(item.playedAt)}</span>
            <span className="rounded-full bg-muted/70 px-3 py-1">来源 {item.context?.label ?? '未知来源'}</span>
          </div>
        </div>

        <div className="flex flex-row items-center gap-2 text-xs text-muted-foreground md:flex-col md:items-end">
          <span className="font-mono uppercase tracking-[0.2em] text-[10px] text-foreground/45">LOG</span>
          {item.songUrl ? (
            <a href={item.songUrl} target="_blank" rel="noreferrer" className="rounded-full border border-border/70 px-3 py-1.5 text-foreground transition hover:border-emerald-500/35 hover:text-emerald-600">
              在 Spotify 打开
            </a>
          ) : null}
          <span className="hidden rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-700 md:inline-flex">{item.artists.length} 位艺人</span>
        </div>
      </div>
    </article>
  )
})


const SavedAlbumsGrid = memo(function SavedAlbumsGrid({
  items,
  total,
  compact = false,
}: {
  items: SpotifySavedAlbum[]
  total: number
  compact?: boolean
}) {
  const visibleItems = compact ? items.slice(0, 6) : items

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>展示最近收藏的 {visibleItems.length} 张专辑</span>
        <span>总量 {total}</span>
      </div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
        {visibleItems.map((item, index) => (
          <div key={`${item.album.id}-${item.addedAt}-${index}`} className={`rounded-[22px] border border-border/60 bg-background/75 ${compact ? 'p-2.5' : 'p-3'}`}>
            <div className="relative aspect-square overflow-hidden rounded-[20px] bg-muted">
              <Artwork src={item.album.imageUrl} alt={item.album.name} />
            </div>
            <div className={`${compact ? 'mt-2' : 'mt-3'}`}>
              <p className="truncate text-sm font-semibold text-foreground">{item.album.name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.album.artists.join(', ')}</p>
              <div className={`space-y-1 text-[11px] text-muted-foreground ${compact ? 'mt-1.5' : 'mt-2'}`}>
                <p>添加于：{formatLocalDateTime(item.addedAt)}</p>
                {!compact ? <p>{item.album.releaseDate ? `发行于 ${item.album.releaseDate}` : '发行时间未知'}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})


export default function SpotifyDashboard({ data }: { data: SpotifyDashboardData }) {
  const overviewCards = [
    {
      label: '最近播放',
      value: data.recentlyPlayed.length,
      note: '回放流',
      href: '#recently-played',
      icon: CalendarClock,
    },
    {
      label: '单曲偏好',
      value: data.topTracks.medium_term.length,
      note: '近 6 个月榜单',
      href: '#top-signature',
      icon: Radio,
    },
    {
      label: '已点赞',
      value: data.library.savedTracks.total,
      note: '曲库主资产',
      href: '#liked-songs',
      icon: Heart,
    },
    {
      label: '关注歌手',
      value: data.library.followedArtists.total,
      note: '长期关注',
      href: '#followed-artists',
      icon: Users2,
    },
    {
      label: '歌单目录',
      value: data.library.playlists.total,
      note: '可展开详情',
      href: '#playlists',
      icon: Library,
    },
  ]

  return (
    <div className="site-shell py-10 pb-24">
      <div className="rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.05),transparent_34%)] p-5 sm:p-6">
        {data.warnings.length > 0 ? (
          <div className="mb-4 rounded-[24px] border border-amber-500/20 bg-amber-500/8 p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-700">Data Warnings</p>
                <p className="mt-1 text-sm text-foreground/85">部分 Spotify 数据本次同步发生降级，下面的相关模块可能不是完整结果。</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-amber-900/80">
                {data.warnings.map((warning) => (
                  <span key={warning} className="rounded-full bg-amber-500/10 px-3 py-1.5">
                    {warning}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <SpotifyLivePlayerPanel />

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {overviewCards.map((card) => {
            const Icon = card.icon

            return (
              <a
                key={card.label}
                href={card.href}
                className="group rounded-[22px] border border-border/60 bg-card/85 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.04)] transition hover:border-emerald-500/25 hover:bg-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{card.label}</p>
                  <Icon className="h-4 w-4 text-emerald-600 transition group-hover:scale-105" strokeWidth={1.8} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{card.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{card.note}</p>
                </div>
              </a>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        <SectionCard
          id="recently-played"
          eyebrow="Playback Log"
          title="最近播放记录"
          description="按时间顺序展开的 listening log，优先展示歌名、艺人和来源。"
        >
          {data.recentlyPlayed.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
              当前没有可展示的 Recently Played 数据。
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentlyPlayed.map((item, index) => (
                <RecentlyPlayedCard key={`${item.id}-${item.playedAt}-${index}`} item={item} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div id="top-signature" className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <SpotifyTopTracksPanel data={data.topTracks} />
        <div className="self-start xl:sticky xl:top-24">
          <SpotifyTopArtistsPanel data={data.topArtists} />
        </div>
      </div>

      <div id="library" className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div id="liked-songs">
          <SpotifySavedTracksPanel
            initialItems={data.library.savedTracks.items}
            total={data.library.savedTracks.total}
          />
        </div>
        <div className="space-y-6">
          <div id="followed-artists">
            <SpotifyFollowedArtistsPanel
              initialItems={data.library.followedArtists.items}
              total={data.library.followedArtists.total}
            />
          </div>

          <SectionCard
            id="saved-albums"
            eyebrow="Saved Albums"
            title="已收藏的专辑"
            description="作为次级资产收纳在侧栏，强调最近加入的收藏脉络。"
          >
            <SavedAlbumsGrid items={data.library.savedAlbums.items} total={data.library.savedAlbums.total} compact />
          </SectionCard>
        </div>
      </div>

      <div className="mt-6">
        <SectionCard
          id="playlists"
          eyebrow="Playlists"
          title="歌单目录"
          description="先浏览歌单目录，再按需展开完整曲目明细。"
        >
          <SpotifyPlaylistBrowser items={data.library.playlists.items} total={data.library.playlists.total} />
        </SectionCard>
      </div>
    </div>
  )
}