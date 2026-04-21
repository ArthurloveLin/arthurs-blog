import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import PageHero from '@/components/PageHero'


export const metadata = { title: 'Message' }
export const revalidate = 60

export default async function GuestbookPage() {
  const config = getNoteBoardConfig('guestbook')
  const messages = await getBoardMessages('guestbook', config.initialPageLimit)

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <PageHero 
          title={config?.subtitle}
          subtitle={config?.title}
          description={config?.intro}
          slogan={{ text1: "Echoes from heart", text2: "Leave a trace" }}
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
