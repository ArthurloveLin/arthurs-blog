import DirectionalTransition from '@/components/DirectionalTransition'
import PageHero from '@/components/PageHero'
import { getSiteConfig } from '@/lib/blog'

export const metadata = { title: 'Music Library' }
export const revalidate = 60

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
        <div className="site-shell py-12 pb-24">
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 border-2 border-dashed border-border/50 rounded-3xl bg-muted/20">
             <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.496 17.306c-.215.353-.674.463-1.028.248-2.857-1.745-6.452-2.14-10.686-1.171-.405.093-.814-.16-.906-.565-.093-.405.16-.814.565-.906 4.63-1.06 8.59-.61 11.78 1.341.353.216.463.675.248 1.028zm1.468-3.26c-.27.44-.848.579-1.288.308-3.27-2.01-8.254-2.59-12.122-1.415-.496.15-1.022-.132-1.173-.628-.15-.496.132-1.022.628-1.172 4.417-1.34 9.907-.694 13.655 1.616.44.27.58.847.31 1.287zm.128-3.418c-3.92-2.328-10.373-2.54-14.135-1.398-.601.183-1.237-.17-1.42-.771-.182-.601.17-1.237.771-1.42 4.31-1.307 11.444-1.055 15.96 1.628.54.32.716 1.014.397 1.554s-1.013.716-1.552.397z"/>
                </svg>
             </div>
             <div className="space-y-1">
               <h3 className="text-xl font-semibold">Music Metrics Coming Soon</h3>
               <p className="text-muted-foreground max-w-md mx-auto">
                 We are currently fine-tuning the data visualization for your listening habits. Stay tuned for deeper insights into your favorite artists and genres.
               </p>
             </div>
          </div>
        </div>
      </main>
    </DirectionalTransition>
  )
}
