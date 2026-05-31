import { Suspense } from 'react'

import DirectionalTransition from '@/components/DirectionalTransition'
import PageHero from '@/components/PageHero'
import SpotifyDashboard from '@/components/spotify/SpotifyDashboard'

import { getSiteConfig } from '@/lib/blog'
import { getMusicReport } from '@/lib/spotify-report'
import { getSpotifyPageCopy, type SpotifyPageCopy } from '@/lib/spotify-page-copy'
import { getStoredSpotifyDashboardData, listRecentlyPlayedDays, readRecentlyPlayedDayShard } from '@/lib/spotify'
import { computeTagAnalysis } from '@/lib/spotify-tag-analysis'
import { getStoredSpotifyTrackTagStore } from '@/lib/spotify-tags'

export const metadata = { title: 'Spotify Dashboard' }
export const revalidate = 3600

async function loadSpotifyDashboardPayload() {
  const [spotifyDashboard, tagStore, recentDays, musicReport] = await Promise.all([
    getStoredSpotifyDashboardData(),
    getStoredSpotifyTrackTagStore(),
    listRecentlyPlayedDays(),
    getMusicReport(),
  ])

  const initialRecentDate = recentDays[0] ?? null
  const initialRecentTracks = initialRecentDate ? await readRecentlyPlayedDayShard(initialRecentDate) : []
  const seenIds = new Set<string>()
  const recentTracks = initialRecentTracks.filter((t) => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  })

  const dashboardForRadar = recentTracks.length > 0
    ? { ...spotifyDashboard, recentlyPlayed: recentTracks }
    : spotifyDashboard

  const tagAnalysis = computeTagAnalysis(dashboardForRadar, tagStore)
  const todayTracksCount = initialRecentTracks.length

  return {
    data: spotifyDashboard,
    initialRecentDate,
    initialRecentDays: recentDays,
    initialRecentTracks,
    musicReport,
    tagAnalysis,
    todayTracksCount,
  }
}

async function SpotifyDashboardLoader({
  copy,
  dashboardPromise,
}: {
  copy: SpotifyPageCopy
  dashboardPromise: ReturnType<typeof loadSpotifyDashboardPayload>
}) {
  const dashboard = await dashboardPromise

  return (
    <SpotifyDashboard
      data={dashboard.data}
      initialRecentDate={dashboard.initialRecentDate}
      initialRecentDays={dashboard.initialRecentDays}
      initialRecentTracks={dashboard.initialRecentTracks}
      tagAnalysis={dashboard.tagAnalysis}
      copy={copy}
      musicReport={dashboard.musicReport}
      todayTracksCount={dashboard.todayTracksCount}
    />
  )
}

function SpotifyDashboardSkeleton() {
  return (
    <div className="site-shell pt-4 pb-24">
      <div className="h-48 rounded-[28px] border border-border/60 bg-card/60 animate-pulse" />
      <div className="mt-6 h-96 rounded-[28px] border border-border/60 bg-card/60 animate-pulse" />
      <div className="mt-6 h-64 rounded-[28px] border border-border/60 bg-card/60 animate-pulse" />
    </div>
  )
}

export default async function SpotifyPage() {
  const dashboardPromise = loadSpotifyDashboardPayload()
  const siteConfig = await getSiteConfig()
  const spotifyCopy = getSpotifyPageCopy(siteConfig)

  const titleNode = spotifyCopy.hero.titleHighlight || spotifyCopy.hero.titleRest ? (
    <>
      {spotifyCopy.hero.titleHighlight && <span className="block text-gradient-primary">{spotifyCopy.hero.titleHighlight}</span>}
      {spotifyCopy.hero.titleHighlight2 && <span className="block text-gradient-primary">{spotifyCopy.hero.titleHighlight2}</span>}
      {spotifyCopy.hero.titleRest}
    </>
  ) : (
    <>
      <span className="block text-gradient-primary">Music</span>
      Library
    </>
  )

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <PageHero 
          title={titleNode}
          subtitle={spotifyCopy.hero.subtitle}
          description={spotifyCopy.hero.description}
          slogan={{ 
            text1: spotifyCopy.hero.slogan1,
            text2: spotifyCopy.hero.slogan2,
          }}
          blobColors={['bg-emerald-400/10', 'bg-green-400/10']}
        />

        {/* ── Body ── */}
        <Suspense fallback={<SpotifyDashboardSkeleton />}>
          <SpotifyDashboardLoader copy={spotifyCopy} dashboardPromise={dashboardPromise} />
        </Suspense>
      </main>
    </DirectionalTransition>
  )
}
