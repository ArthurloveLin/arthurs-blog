import type { ReactNode } from 'react'

import Image from 'next/image'
import { AlertTriangle, CalendarClock, Heart, Library, Mic2, Music2, Users2 } from 'lucide-react'

import type {
  SpotifyDashboardData,
  SpotifyFollowedArtist,
  SpotifyPlaylist,
  SpotifyRecentlyPlayedTrack,
  SpotifySavedAlbum,
  SpotifySavedTrack,
} from '@/lib/spotify-types'

import SpotifyTopArtistsPanel from './SpotifyTopArtistsPanel'
import SpotifyTopTracksPanel from './SpotifyTopTracksPanel'
import SpotifyWidePlayer from './SpotifyWidePlayer'

function formatLocalDateTime(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function SectionCard({
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
    <section id={id} className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
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

function RecentlyPlayedCard({ item }: { item: SpotifyRecentlyPlayedTrack }) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-background/75 p-4">
      <div className="flex items-start gap-4">
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

          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="rounded-2xl bg-muted/70 px-3 py-2">
              <p className="font-mono uppercase tracking-[0.18em] text-[10px]">played_at</p>
              <p className="mt-1 break-all font-mono text-[11px] text-foreground/80">{item.playedAt}</p>
              <p className="mt-1">{formatLocalDateTime(item.playedAt)}</p>
            </div>
            <div className="rounded-2xl bg-muted/70 px-3 py-2">
              <p className="font-mono uppercase tracking-[0.18em] text-[10px]">context</p>
              <p className="mt-1 text-sm text-foreground/85">{item.context?.label ?? '未知来源'}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em]">{item.context ? item.context.type : 'unknown'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SavedTracksList({ items, total }: { items: SpotifySavedTrack[]; total: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>展示最近加入喜欢列表的 {items.length} 首</span>
        <span>总量 {total}</span>
      </div>
      <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={`${item.track.id}-${item.addedAt}`} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-[22px] border border-border/60 bg-background/75 p-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-muted">
              <Artwork src={item.track.albumImageUrl} alt={item.track.album} />
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.track.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.track.artists.join(', ')}</p>
                </div>
                {item.track.songUrl ? (
                  <a href={item.track.songUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:text-emerald-500">
                    打开
                  </a>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-foreground/70">{item.track.album}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="font-mono">added_at {item.addedAt}</span>
                <span>{formatLocalDateTime(item.addedAt)}</span>
                <span>{formatDuration(item.track.durationMs)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SavedAlbumsGrid({ items, total }: { items: SpotifySavedAlbum[]; total: number }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>展示最近收藏的 {items.length} 张专辑</span>
        <span>总量 {total}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={`${item.album.id}-${item.addedAt}`} className="rounded-[22px] border border-border/60 bg-background/75 p-3">
            <div className="relative aspect-square overflow-hidden rounded-[20px] bg-muted">
              <Artwork src={item.album.imageUrl} alt={item.album.name} />
            </div>
            <div className="mt-3">
              <p className="truncate text-sm font-semibold text-foreground">{item.album.name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.album.artists.join(', ')}</p>
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <p className="font-mono">added_at {item.addedAt}</p>
                <p>{item.album.releaseDate ? `发行于 ${item.album.releaseDate}` : '发行时间未知'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FollowedArtistsGrid({ items, total }: { items: SpotifyFollowedArtist[]; total: number }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>展示最近同步到的 {items.length} 位关注歌手</span>
        <span>总量 {total}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((artist) => (
          <div key={artist.id} className="rounded-[22px] border border-border/60 bg-background/75 p-4">
            <div className="flex items-center gap-3">
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{artist.name}</p>
                <p className="text-xs text-muted-foreground">
                  {artist.followers ? `${artist.followers.toLocaleString()} followers` : '未返回 followers'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {artist.genres.length > 0 ? (
                artist.genres.slice(0, 5).map((genre) => (
                  <span key={genre} className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-foreground/80">
                    {genre}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">无 genres 标签</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaylistsBoard({ items, total }: { items: SpotifyPlaylist[]; total: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>已同步 {items.length} 个歌单，保留歌单内完整曲目列表与 added_at</span>
        <span>总量 {total}</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
          当前账户没有可展示的歌单。
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((playlist) => (
            <details key={playlist.id} className="group rounded-[24px] border border-border/60 bg-background/75 p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[22px] bg-muted">
                      <Artwork src={playlist.imageUrl} alt={playlist.name} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-semibold text-foreground">{playlist.name}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {playlist.ownerName ? `Owner ${playlist.ownerName}` : 'Owner 未知'}
                      </p>
                      {playlist.description ? (
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/75">{playlist.description}</p>
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
                <div className="max-h-[480px] overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {playlist.tracks.map((item, index) => (
                      <div key={`${playlist.id}-${item.track.id}-${item.addedAt ?? index}`} className="grid gap-3 rounded-[20px] border border-border/50 bg-card/80 p-3 md:grid-cols-[40px_minmax(0,1fr)_220px] md:items-center">
                        <div className="font-mono text-sm text-muted-foreground">#{index + 1}</div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.track.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.track.artists.join(', ')}</p>
                          <p className="mt-1 truncate text-xs text-foreground/70">{item.track.album}</p>
                        </div>
                        <div className="text-xs text-muted-foreground md:text-right">
                          <p className="font-mono">{item.addedAt ?? 'added_at unavailable'}</p>
                          {item.addedAt ? <p className="mt-1">{formatLocalDateTime(item.addedAt)}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SpotifyDashboard({ data }: { data: SpotifyDashboardData }) {
  const overviewCards = [
    {
      label: 'Recently Played',
      value: data.recentlyPlayed.length,
      note: '本页展示绝对时间与播放来源上下文',
      icon: CalendarClock,
    },
    {
      label: 'Liked Songs',
      value: data.library.savedTracks.total,
      note: '预览列表保留 added_at 原始时间戳',
      icon: Heart,
    },
    {
      label: 'Followed Artists',
      value: data.library.followedArtists.total,
      note: 'genres 可直接用于词云与聚类',
      icon: Users2,
    },
    {
      label: 'Playlists',
      value: data.library.playlists.total,
      note: '每个歌单都包含完整曲目明细',
      icon: Library,
    },
  ]

  const taskItems = [
    '抽取共享 Spotify 服务层，统一 access token 刷新与请求封装',
    '实现宽屏顶部播放器，保持未展开卡片形态但加强信息密度',
    '落 Recently Played，展示详细元数据、played_at 与 context 解析结果',
    '落 Top Tracks，按 short_term / medium_term / long_term 拉取前 50 名',
    '落 Top Artists，按三种时间跨度拉取并保留 genres 数组',
    '落曲库模块：liked songs、saved albums、followed artists、playlists',
    '同步歌单内部所有曲目与 added_at，改为可展开的数据面板',
    '更新 Spotify 授权脚本 scope，保证以后重新换 token 时仍覆盖这些接口',
  ]

  return (
    <div className="site-shell py-10 pb-24">
      <div className="rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.05),transparent_34%)] p-5 sm:p-6">
        <SpotifyWidePlayer />

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

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <SectionCard
          eyebrow="Build Queue"
          title="任务清单"
          description={`已按顺序完成实现；本次 Spotify dashboard 数据拉取时间为 ${formatLocalDateTime(data.fetchedAt)}。`}
        >
          <div className="space-y-3">
            {taskItems.map((item, index) => (
              <div key={item} className="flex gap-4 rounded-[22px] border border-border/60 bg-background/75 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-600">Completed</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          id="recently-played"
          eyebrow="Recently Played"
          title="最近播放记录"
          description="每条记录都保留歌曲详细元数据、played_at 原始 ISO 时间戳，以及解析后的播放来源上下文。"
        >
          {data.recentlyPlayed.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
              当前没有可展示的 Recently Played 数据。
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.recentlyPlayed.map((item) => (
                <RecentlyPlayedCard key={`${item.id}-${item.playedAt}`} item={item} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SpotifyTopTracksPanel data={data.topTracks} />
        <SpotifyTopArtistsPanel data={data.topArtists} />
      </div>

      <div id="library" className="mt-6 grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <SectionCard
          eyebrow="Library Data"
          title="已点赞的歌曲"
          description="使用 saved tracks 接口同步最近加入喜欢列表的曲目，并保留 added_at 时间戳。"
        >
          <SavedTracksList items={data.library.savedTracks.items} total={data.library.savedTracks.total} />
        </SectionCard>

        <SectionCard
          eyebrow="Saved Albums"
          title="已收藏的专辑"
          description="保留专辑封面、专辑名、歌手与收藏时间，适合后续继续扩成专辑维度分析。"
        >
          <SavedAlbumsGrid items={data.library.savedAlbums.items} total={data.library.savedAlbums.total} />
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <SectionCard
          eyebrow="Followed Artists"
          title="关注的歌手"
          description="展示歌手头像、followers 与 genres 预览；genres 已原样保留，方便后续做标签可视化。"
        >
          <FollowedArtistsGrid items={data.library.followedArtists.items} total={data.library.followedArtists.total} />
        </SectionCard>

        <SectionCard
          eyebrow="Playlists"
          title="用户歌单"
          description="展开任意歌单即可查看封面、名称、描述、歌曲总数，以及歌单内所有曲目与 added_at。"
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