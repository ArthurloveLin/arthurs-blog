import { Suspense } from 'react'

import DirectionalTransition from '@/components/DirectionalTransition'
import PageHero from '@/components/PageHero'
import SpotifyDashboard from '@/components/spotify/SpotifyDashboard'

import { getSiteConfig } from '@/lib/blog'
import { getStoredSpotifyDashboardData, listRecentlyPlayedDays, readRecentlyPlayedDayShard } from '@/lib/spotify'
import { computeTagAnalysis } from '@/lib/spotify-tag-analysis'
import { getStoredSpotifyTrackTagStore } from '@/lib/spotify-tags'

export const metadata = { title: 'Spotify Dashboard' }
export const revalidate = 3600

async function SpotifyDashboardLoader() {
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
  return <SpotifyDashboard data={spotifyDashboard} tagAnalysis={tagAnalysis} />
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

  const titleNode = siteConfig.spotify_hero_title_highlight || siteConfig.spotify_hero_title_rest ? (
    <>
      {siteConfig.spotify_hero_title_highlight && <span className="block text-gradient-primary">{siteConfig.spotify_hero_title_highlight}</span>}
      {siteConfig.spotify_hero_title_highlight_2 && <span className="block text-gradient-primary">{siteConfig.spotify_hero_title_highlight_2}</span>}
      {siteConfig.spotify_hero_title_rest}
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
          subtitle={siteConfig.spotify_hero_subtitle || "METRICS & MELODIES"}
          description={siteConfig.spotify_hero_description || "Tracing the rhythms that define my journey. A real-time audit of my listening habits and personal soundtracks."}
          slogan={{ 
            text1: siteConfig.spotify_slogan_1 || "Where words fail,", 
            text2: siteConfig.spotify_slogan_2 || "music speaks." 
          }}
          blobColors={['bg-emerald-400/10', 'bg-green-400/10']}
        />

        {/* ── Body ── */}
        <Suspense fallback={<SpotifyDashboardSkeleton />}>
          <SpotifyDashboardLoader />
        </Suspense>
      </main>
    </DirectionalTransition>
  )
}
