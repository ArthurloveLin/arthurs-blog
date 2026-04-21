import DirectionalTransition from '@/components/DirectionalTransition'
import PageHero from '@/components/PageHero'
import SpotifyDashboard from '@/components/spotify/SpotifyDashboard'
import { getSiteConfig } from '@/lib/blog'
import { getSpotifyDashboardData } from '@/lib/spotify'

export const metadata = { title: 'Spotify Dashboard' }
export const dynamic = 'force-dynamic'

export default async function SpotifyPage() {
  const [siteConfig, spotifyDashboard] = await Promise.all([
    getSiteConfig(),
    getSpotifyDashboardData(),
  ])

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
        <SpotifyDashboard data={spotifyDashboard} />
      </main>
    </DirectionalTransition>
  )
}
