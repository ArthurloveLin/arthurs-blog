import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import HandwrittenSloganClient from '@/components/HandwrittenSloganClient'


export const metadata = { title: 'Message' }
export const revalidate = 60

export default async function GuestbookPage() {
  const config = getNoteBoardConfig('guestbook')
  const messages = await getBoardMessages('guestbook', config.initialPageLimit)

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <div className="relative border-b border-border bg-background overflow-hidden">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-rose-400/10 rounded-full filter blur-2xl opacity-50 animate-blob pointer-events-none"></div>
          <div className="absolute -top-10 right-1/4 w-72 h-72 bg-pink-400/10 rounded-full filter blur-2xl opacity-50 animate-blob animation-delay-2000 pointer-events-none"></div>

          <div className="site-shell relative pt-14 pb-12 lg:pt-20 lg:pb-16 z-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[100px] md:inset-0 md:h-full flex items-center justify-center">
              <HandwrittenSloganClient 
                text1="Echoes from heart" 
                text2="Leave a trace" 
                size1="max(32px, min(6vw, 68px))"
                size2="max(20px, min(4vw, 46px))"
              />
            </div>

            <div className="relative z-10">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {config?.title}
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-[2.75rem]">{config?.subtitle}</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-2xl">{config?.intro}</p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="site-shell py-12 pb-24">
          <NoteBoardPage board={config} initialMessages={messages} />
        </div>
      </main>

    </DirectionalTransition>
  )
}
