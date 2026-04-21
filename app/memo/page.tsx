import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import PageHero from '@/components/PageHero'


export const metadata = { title: 'Memo' }
export const revalidate = 60

export default async function MemoPage() {
  const config = getNoteBoardConfig('memo')
  const messages = await getBoardMessages('memo', config.initialPageLimit, 0, false, 'time')

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <PageHero 
          title={config?.subtitle}
          subtitle={config?.title}
          description={config?.intro}
          slogan={{ text1: "Capturing the spark", text2: "Whispers of time" }}
          blobColors={['bg-purple-400/10', 'bg-indigo-400/10']}
        />

        {/* ── Body ── */}
        <div className="site-shell py-12 pb-24">
          <NoteBoardPage board={config} initialMessages={messages} />
        </div>
      </main>

    </DirectionalTransition>
  )
}