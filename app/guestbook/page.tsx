import { cookies } from 'next/headers'
import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { isValidNoteThemeId } from '@/lib/note-color-theme'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import { getSiteConfig } from '@/lib/blog'
import {
  getNoteBoardViewModeCookieName,
  normalizeNoteBoardViewMode,
} from '@/lib/note-board-view-mode'
import PageHero from '@/components/PageHero'


export const metadata = { title: 'Message' }
export const revalidate = 900

export default async function GuestbookPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const config = getNoteBoardConfig('guestbook')
  const [params, cookieStore] = await Promise.all([searchParams, cookies()])
  const rawTheme = cookieStore.get('note-color-theme')?.value
  const initialThemeId = isValidNoteThemeId(rawTheme) ? rawTheme : undefined
  const { q } = params
  const initialQuery = typeof q === 'string' ? q.trim() : ''
  const initialViewMode = normalizeNoteBoardViewMode(
    cookieStore.get(getNoteBoardViewModeCookieName(config.slug))?.value,
  )
  const [messages, siteConfig] = await Promise.all([
    getBoardMessages('guestbook', config.initialPageLimit, 0, false, 'time', 'desc', null, initialQuery || null),
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
          filename="GUESTBOOK.md"
          slogan={{
            text1: siteConfig.guestbook_slogan_1 || "Echoes from heart",
            text2: siteConfig.guestbook_slogan_2 || "Leave a trace"
          }}
          blobColors={['bg-rose-400/10', 'bg-pink-400/10']}
        />

        {/* ── Body ── */}
        <div className="site-shell py-12 pb-24">
          <NoteBoardPage board={config} initialMessages={messages} initialQuery={initialQuery} initialViewMode={initialViewMode} initialThemeId={initialThemeId} />
        </div>
      </main>

    </DirectionalTransition>
  )
}
