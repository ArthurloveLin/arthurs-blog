import { memo, type CSSProperties, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle } from 'lucide-react'

import type {
  SpotifyDashboardData,
  SpotifyPlaylistPreview,
  SpotifyTagAnalysis,
} from '@/lib/spotify-types'
import type { MusicReport } from '@/lib/spotify-report'
import type { SpotifyPageCopy } from '@/lib/spotify-page-copy'
import SpotifyVinylAlbumsPanel from './SpotifyVinylAlbumsPanel'
import SpotifyLiveNowPlayingSection from './SpotifyLiveNowPlayingSection'
import SpotifyMusicReportSection from './SpotifyMusicReportSection'
import SpotifyPlaylistDetail from './SpotifyPlaylistDetail'
import SpotifyRecentlyPlayedSection from './SpotifyRecentlyPlayedSection'
import SpotifySavedTracksPanel from './SpotifySavedTracksPanel'
import SpotifyTopArtistsPanel from './SpotifyTopArtistsPanel'
import SpotifyTopTracksPanel from './SpotifyTopTracksPanel'

const SpotifyTagCloudCard = dynamic(() => import('./SpotifyTagCloudCard'))
const SpotifyTagRadarCard = dynamic(() => import('./SpotifyTagRadarCard'))

// Below-the-fold sections are skipped for layout/paint until scrolled near the
// viewport. `auto` in containIntrinsicSize remembers the real size after first
// render; the px value is just the initial placeholder estimate (the live and
// recently-played sections at the top stay eager and are intentionally excluded).
const deferredSection: CSSProperties = { contentVisibility: 'auto', containIntrinsicSize: 'auto 520px' }
const deferredTallSection: CSSProperties = { contentVisibility: 'auto', containIntrinsicSize: 'auto 1600px' }

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
    <section id={id} className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground whitespace-nowrap">{eyebrow}</p>
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


export default function SpotifyDashboard({
  data,
  initialRecentDate,
  initialRecentDays,
  initialRecentTracks,
  tagAnalysis,
  copy,
  musicReport,
  todayTracksCount,
}: {
  data: SpotifyDashboardData
  initialRecentDate: string | null
  initialRecentDays: string[]
  initialRecentTracks: SpotifyDashboardData['recentlyPlayed']
  tagAnalysis: SpotifyTagAnalysis
  copy: SpotifyPageCopy
  musicReport: MusicReport | null
  todayTracksCount?: number
}) {
  const stats = {
    recentlyPlayed: todayTracksCount ?? data.recentlyPlayed.length,
    likedSongs: data.library.savedTracks.total,
    playlists: data.library.playlists.total,
  }

  return (
    <div className="site-shell pt-4 pb-24">
      <SpotifyLiveNowPlayingSection stats={stats} />

      <div className="mt-4">
        <SpotifyRecentlyPlayedSection
          items={data.recentlyPlayed}
          copy={copy.recent}
          initialHistoryDate={initialRecentDate}
          initialHistoryTracks={initialRecentTracks}
          initialAvailableDays={initialRecentDays}
        />
      </div>

      <div className="mt-4" style={deferredSection}>
        <SpotifyMusicReportSection copy={copy.report} report={musicReport} />
      </div>

      <div className="mt-4" style={deferredSection}>
        <SpotifyTopArtistsPanel data={data.topArtists} copy={copy.topArtists} />
      </div>

      <div className="mt-4" style={deferredSection}>
        <SpotifyVinylAlbumsPanel
          items={data.library.savedAlbums.items}
          total={data.library.savedAlbums.total}
          copy={copy.savedAlbums}
        />
      </div>

      <div className="mt-4 space-y-4" style={deferredTallSection}>
        <SpotifyTopTracksPanel data={data.topTracks} copy={copy.topTracks} />
        <SpotifySavedTracksPanel
          initialItems={data.library.savedTracks.items}
          total={data.library.savedTracks.total}
          copy={copy.savedTracks}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-stretch" style={deferredSection}>
        <SpotifyTagCloudCard analysis={tagAnalysis} copy={copy.tagCloud} />
        <SpotifyTagRadarCard analysis={tagAnalysis} copy={copy.tagRadar} />
      </div>

      <div className="mt-4" style={deferredSection}>
        <SectionCard
          eyebrow={copy.playlists.eyebrow}
          id="playlists"
          title={copy.playlists.title}
          description={copy.playlists.description}
        >
          <PlaylistsBoard items={data.library.playlists.items} total={data.library.playlists.total} />
        </SectionCard>
      </div>

      {data.warnings.length > 0 ? (
        <SectionCard
          eyebrow={copy.warnings.eyebrow}
          title={copy.warnings.title}
          description={copy.warnings.description}
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
