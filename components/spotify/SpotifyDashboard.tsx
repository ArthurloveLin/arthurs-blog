import { memo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import type {
  SpotifyDashboardData,
  SpotifyPlaylistPreview,
} from '@/lib/spotify-types'
import SpotifyVinylAlbumsPanel from './SpotifyVinylAlbumsPanel'
import SpotifyLivePlayerPanel from './SpotifyLivePlayerPanel'
import SpotifyPlaylistDetail from './SpotifyPlaylistDetail'
import SpotifyRecentlyPlayedDeck from './SpotifyRecentlyPlayedDeck'
import SpotifySavedTracksPanel from './SpotifySavedTracksPanel'
import SpotifyTopArtistsPanel from './SpotifyTopArtistsPanel'
import SpotifyTopTracksPanel from './SpotifyTopTracksPanel'

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
    <section id={id} className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60_rgba(0,0,0,0.05)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground whitespace-nowrap">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
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
        <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/20 p-4 sm:p-6 text-sm text-muted-foreground">
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
  const stats = {
    recentlyPlayed: data.recentlyPlayed.length,
    likedSongs: data.library.savedTracks.total,
    playlists: data.library.playlists.total,
  }

  return (
    <div className="site-shell py-10 pb-24">
      <div className="rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.05),transparent_34%)] p-4 sm:p-5 md:p-6">
        <SpotifyLivePlayerPanel stats={stats} />
      </div>

      <div className="mt-6">
        <SectionCard
          id="recently-played"
          eyebrow="Recently Played"
          title="最近播放记录"
          description="悬停卡片可查看艺人、时间和播放来源。"
        >
          <SpotifyRecentlyPlayedDeck items={data.recentlyPlayed} />
        </SectionCard>
      </div>

      <div className="mt-6">
        <SpotifyTopArtistsPanel data={data.topArtists} />
      </div>

      <div className="mt-6">
        <SpotifyVinylAlbumsPanel
          items={data.library.savedAlbums.items}
          total={data.library.savedAlbums.total}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SpotifyTopTracksPanel data={data.topTracks} />
        <SpotifySavedTracksPanel
          initialItems={data.library.savedTracks.items}
          total={data.library.savedTracks.total}
        />
      </div>

      <div className="mt-6">
        <SectionCard
          eyebrow="Playlists"
          id="playlists"
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