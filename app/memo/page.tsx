import { cookies } from 'next/headers'
import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import { getSiteConfig } from '@/lib/blog'
import {
  getNoteBoardViewModeCookieName,
  normalizeNoteBoardViewMode,
} from '@/lib/note-board-view-mode'
import PageHero from '@/components/PageHero'

export const metadata = { title: 'Memo' }
export const revalidate = 300

export default async function MemoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const config = getNoteBoardConfig('memo')
  const [params, cookieStore] = await Promise.all([searchParams, cookies()])
  const { q } = params
  const initialQuery = typeof q === 'string' ? q.trim() : ''
  const initialViewMode = normalizeNoteBoardViewMode(
    cookieStore.get(getNoteBoardViewModeCookieName(config.slug))?.value,
  )

  const [messages, siteConfig] = await Promise.all([
    getBoardMessages('memo', config.initialPageLimit, 0, false, 'time', 'desc', null, initialQuery || null),
    getSiteConfig(),
  ])

  const titleNode = siteConfig.memo_hero_title_highlight || siteConfig.memo_hero_title_rest ? (
    <>
      {siteConfig.memo_hero_title_highlight && <span className="block text-gradient-primary">{siteConfig.memo_hero_title_highlight}</span>}
      {siteConfig.memo_hero_title_highlight_2 && <span className="block text-gradient-primary">{siteConfig.memo_hero_title_highlight_2}</span>}
      {siteConfig.memo_hero_title_rest}
    </>
  ) : config?.subtitle

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <PageHero
          title={titleNode}
          subtitle={siteConfig.memo_hero_subtitle || config?.title}
          description={siteConfig.memo_hero_description || config?.intro}
          slogan={{
            text1: siteConfig.memo_slogan_1 || "Capturing the spark",
            text2: siteConfig.memo_slogan_2 || "Whispers of time"
          }}
          blobColors={['bg-purple-400/10', 'bg-indigo-400/10']}
        />

        {/* ── Body ── */}
        <div className="site-shell py-12 pb-24">
          <NoteBoardPage board={config} initialMessages={messages} initialQuery={initialQuery} initialViewMode={initialViewMode} />
        </div>
      </main>
    </DirectionalTransition>
  )
}
