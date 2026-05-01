'use client'

import type { MusicReport, MusicReportStats } from '@/lib/spotify-report'
import PosterShell from './PosterShell'
import TopTrackPoster from './posters/TopTrackPoster'
import TopArtistPoster from './posters/TopArtistPoster'
import StatsInsightPoster from './posters/StatsInsightPoster'
import VibePoster from './posters/VibePoster'
import styles from './SpotifyMusicReportBoard.module.css'

type Period = 'day' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  day: '今天',
  week: '本周',
  month: '本月',
}

const EMPTY_STATS = (period: Period): MusicReportStats => ({
  period,
  periodLabel: PERIOD_LABELS[period],
  dateRange: '—',
  topTrack: null,
  topArtist: null,
  top5Tracks: [],
  top5Artists: [],
  topContext: null,
  top2Contexts: [],
  topTag: null,
  totalPlays: 0,
  totalMinutes: 0,
  peakHour: null,
})

const POSTER_CONFIGS = [
  { rotation: -3,   pinColor: '#c0392b', tapeRotation: -2   },
  { rotation: 1.5,  pinColor: '#1a5c35', tapeRotation: 1.2  },
  { rotation: -1.8, pinColor: '#263694', tapeRotation: -1   },
  { rotation: 2.8,  pinColor: '#6b1a6b', tapeRotation: 2    },
] as const

interface Props {
  report: MusicReport
  activePeriod: Period
  isTransitioning: boolean
}

export default function SpotifyMusicReportBoard({ report, activePeriod, isTransitioning }: Props) {
  const stats = report[activePeriod] ?? EMPTY_STATS(activePeriod)
  const isLoading = false

  return (
    <div className={styles.board}>
      {/* 4 content-dimension posters */}
      <div className={styles.posters}>
        {/* TopTrack — 最宽，主角 */}
        <PosterShell rotation={POSTER_CONFIGS[0].rotation} pinColor={POSTER_CONFIGS[0].pinColor} tapeRotation={POSTER_CONFIGS[0].tapeRotation} width={262}>
          <TopTrackPoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>

        {/* TopArtist */}
        <PosterShell rotation={POSTER_CONFIGS[1].rotation} pinColor={POSTER_CONFIGS[1].pinColor} tapeRotation={POSTER_CONFIGS[1].tapeRotation} width={232}>
          <TopArtistPoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>

        {/* StatsInsight — 榜单需要更宽的双列 */}
        <PosterShell rotation={POSTER_CONFIGS[2].rotation} pinColor={POSTER_CONFIGS[2].pinColor} tapeRotation={POSTER_CONFIGS[2].tapeRotation} width={292}>
          <StatsInsightPoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>

        {/* Vibe */}
        <PosterShell rotation={POSTER_CONFIGS[3].rotation} pinColor={POSTER_CONFIGS[3].pinColor} tapeRotation={POSTER_CONFIGS[3].tapeRotation} width={232}>
          <VibePoster stats={stats} isLoading={isLoading} isTransitioning={isTransitioning} />
        </PosterShell>
      </div>
    </div>
  )
}
