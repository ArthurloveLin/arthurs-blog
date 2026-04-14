import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'

export const metadata = { title: 'Memo' }
export const revalidate = 60

export default async function MemoPage() {
  const config = getNoteBoardConfig('memo')
  const messages = await getBoardMessages('memo', config.initialPageLimit, 0, false, 'time')

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background pt-12 pb-24">
        <div className="site-shell">
          <div className="mb-10 max-w-2xl">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {config?.title}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-[2.75rem]">{config?.subtitle}</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{config?.intro}</p>
          </div>
          <NoteBoardPage board={config} initialMessages={messages} />
        </div>
      </main>
    </DirectionalTransition>
  )
}