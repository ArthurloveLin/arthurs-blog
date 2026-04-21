import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import { getSiteConfig } from '@/lib/blog'
import PageHero from '@/components/PageHero'


export const metadata = { title: 'Message' }
export const revalidate = 60

export default async function GuestbookPage() {
  const config = getNoteBoardConfig('guestbook')
  const [messages, siteConfig] = await Promise.all([
    getBoardMessages('guestbook', config.initialPageLimit),
    getSiteConfig()
  ])

  const titleNode = siteConfig.guestbook_hero_title_highlight || siteConfig.guestbook_hero_title_rest ? (
    <>
      {siteConfig.guestbook_hero_title_highlight && <span className="block text-gradient-primary">{siteConfig.guestbook_hero_title_highlight}</span>}
      {siteConfig.guestbook_hero_title_highlight_2 && <span className="block text-gradient-primary">{siteConfig.guestbook_hero_title_highlight_2}</span>}
      {siteConfig.guestbook_hero_title_rest}
    </>
  ) : config?.subtitle

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <PageHero 
          title={titleNode}
          subtitle={siteConfig.guestbook_hero_subtitle || config?.title}
          description={siteConfig.guestbook_hero_description || config?.intro}
          slogan={{ 
            text1: siteConfig.guestbook_slogan_1 || "Echoes from heart", 
            text2: siteConfig.guestbook_slogan_2 || "Leave a trace" 
          }}
          blobColors={['bg-rose-400/10', 'bg-pink-400/10']}
        />

        {/* ── Body ── */}
        <div className="site-shell py-12 pb-24">
          <NoteBoardPage board={config} initialMessages={messages} />
        </div>
      </main>

    </DirectionalTransition>
  )
}
