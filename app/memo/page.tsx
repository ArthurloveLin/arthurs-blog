import { Suspense } from 'react'
import { cookies } from 'next/headers'
import DirectionalTransition from '@/components/DirectionalTransition'
import { NoteBoardPage } from '@/components/note-board/NoteBoardExperience'
import { isValidNoteThemeId, type NoteColorThemeId } from '@/lib/note-color-theme'
import { getNoteBoardConfig, type NoteBoardViewConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import { getSiteConfig } from '@/lib/blog'
import {
  getNoteBoardViewModeCookieName,
  normalizeNoteBoardViewMode,
  type NoteBoardViewMode,
} from '@/lib/note-board-view-mode'
import PageHero from '@/components/PageHero'
import { getCurrentUser } from '@/lib/auth'

export const metadata = { title: 'Memo' }
// Memo is per-user — cannot be statically cached
export const dynamic = 'force-dynamic'

// Skeleton shown while auth + DB queries run inside the Suspense boundary
function MemoBoardSkeleton() {
  return (
    <div className="animate-pulse rounded-[32px] border border-border/60 bg-card/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-lg bg-muted/60 sm:h-10 sm:w-40" />
          <div className="h-4 w-24 rounded-full bg-muted/40" />
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[34px] w-[34px] rounded-full bg-muted/50" />
          ))}
        </div>
      </div>
      <div className="flex gap-6">
        <div className="hidden space-y-4 sm:block sm:w-[240px] lg:w-[280px]">
          <div className="h-[220px] rounded-2xl bg-muted/40" />
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-muted/40" />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-[20px] bg-muted/40" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Async Server Component — runs inside the Suspense boundary so auth + data
// fetching does not block the Hero from streaming to the browser.
async function MemoBoard({
  config,
  initialQuery,
  initialViewMode,
  initialThemeId,
  initialFocusNoteId,
}: {
  config: NoteBoardViewConfig
  initialQuery: string
  initialViewMode: NoteBoardViewMode
  initialThemeId?: NoteColorThemeId
  initialFocusNoteId?: string
}) {
  const currentUser = await getCurrentUser()
  // Load the full active working set (no server-side search). Active memos are
  // resident on the client and filtered in-memory; initialQuery (?q=) is applied
  // client-side via filterItems, so SSR must not pre-filter or it would ship a
  // partial set that the client then can't expand without a refetch.
  const messages = await getBoardMessages(
    'memo',
    config.initialPageLimit,
    0,
    false,
    'time',
    'desc',
    null,
    null,
    [],
    currentUser?.id ?? null,
  )
  return (
    <NoteBoardPage
      board={config}
      initialMessages={messages}
      initialQuery={initialQuery}
      initialViewMode={initialViewMode}
      initialThemeId={initialThemeId}
      initialFocusNoteId={initialFocusNoteId}
    />
  )
}

export default async function MemoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; note?: string }>
}) {
  const config = getNoteBoardConfig('memo')

  // getSiteConfig is now parallel with cookies/searchParams — no longer blocked
  // by getCurrentUser. Hero renders as soon as this resolves.
  const [params, cookieStore, siteConfig] = await Promise.all([
    searchParams,
    cookies(),
    getSiteConfig(),
  ])

  const { q, note } = params
  const initialQuery = typeof q === 'string' ? q.trim() : ''
  // ntfy deep link: open the board filtered to the reminder's note
  const initialFocusNoteId = typeof note === 'string' && note.trim() ? note.trim() : undefined
  const initialViewMode = normalizeNoteBoardViewMode(
    cookieStore.get(getNoteBoardViewModeCookieName(config.slug))?.value,
  )
  const rawTheme = cookieStore.get('note-color-theme')?.value
  const initialThemeId = isValidNoteThemeId(rawTheme) ? rawTheme : undefined

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
        {/* Hero streams immediately — not blocked by auth or note queries */}
        <PageHero
          title={titleNode}
          subtitle={siteConfig.memo_hero_subtitle || config?.title}
          description={siteConfig.memo_hero_description || config?.intro}
          filename="MEMO.md"
          slogan={{
            text1: siteConfig.memo_slogan_1 || 'Capturing the spark',
            text2: siteConfig.memo_slogan_2 || 'Whispers of time',
          }}
          blobColors={['bg-purple-400/10', 'bg-indigo-400/10']}
        />

        {/* Board streams in after auth + DB queries resolve */}
        <div className="site-shell py-12 pb-24">
          <Suspense fallback={<MemoBoardSkeleton />}>
            <MemoBoard
              config={config}
              initialQuery={initialQuery}
              initialViewMode={initialViewMode}
              initialThemeId={initialThemeId}
              initialFocusNoteId={initialFocusNoteId}
            />
          </Suspense>
        </div>
      </main>
    </DirectionalTransition>
  )
}
