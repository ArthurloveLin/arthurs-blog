import { Suspense } from 'react'

import DirectionalTransition from '@/components/DirectionalTransition'
import PageHero from '@/components/PageHero'
import SpotifyDashboard from '@/components/spotify/SpotifyDashboard'

import { getSiteConfig } from '@/lib/blog'
import { getSpotifyPageCopy, type SpotifyPageCopy } from '@/lib/spotify-page-copy'
import { getStoredSpotifyDashboardData, listRecentlyPlayedDays, readRecentlyPlayedDayShard } from '@/lib/spotify'
import { computeTagAnalysis } from '@/lib/spotify-tag-analysis'
import { getStoredSpotifyTrackTagStore } from '@/lib/spotify-tags'

export const metadata = { title: 'Spotify Dashboard' }
export const revalidate = 3600

async function SpotifyDashboardLoader({ copy }: { copy: SpotifyPageCopy }) {
  const [spotifyDashboard, tagStore, recentDays] = await Promise.all([
    getStoredSpotifyDashboardData(),
    getStoredSpotifyTrackTagStore(),
    listRecentlyPlayedDays(7),
  ])

  const shards = await Promise.all(recentDays.map(readRecentlyPlayedDayShard))
  const seenIds = new Set<string>()
  const recentTracks = shards.flat().filter((t) => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  })

  const dashboardForRadar = recentTracks.length > 0
    ? { ...spotifyDashboard, recentlyPlayed: recentTracks }
    : spotifyDashboard

  const tagAnalysis = computeTagAnalysis(dashboardForRadar, tagStore)
  const todayTracksCount = shards.length > 0 ? shards[0].length : 0

  return <SpotifyDashboard data={spotifyDashboard} tagAnalysis={tagAnalysis} copy={copy} todayTracksCount={todayTracksCount} />
}

function SpotifyDashboardSkeleton() {
  return (
    <div className="site-shell py-10 pb-24">
      <div className="h-48 rounded-[32px] border border-border/60 bg-card/60 animate-pulse" />
      <div className="mt-6 h-96 rounded-[28px] border border-border/60 bg-card/60 animate-pulse" />
      <div className="mt-6 h-64 rounded-[28px] border border-border/60 bg-card/60 animate-pulse" />
    </div>
  )
}

export default async function SpotifyPage() {
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
          <SpotifyDashboardLoader copy={spotifyCopy} />
        </Suspense>
      </main>
    </DirectionalTransition>
  )
}
