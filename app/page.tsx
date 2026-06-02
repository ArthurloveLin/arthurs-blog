import BlogPage from '@/components/BlogPage'
import type { StickyStackPreviewMessage } from '@/components/note-board/views/StickyStackPreview'
import { getStableYear } from '@/lib/date-format'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'
import { getPostsByYear, getSiteConfig, type Post } from '@/lib/blog'

export const revalidate = 1800

export default async function HomePage() {
  const currentYear = getStableYear()
  const guestbookConfig = getNoteBoardConfig('guestbook')

  // Render the feed synchronously (pass `posts`, no Suspense) so every
  // post-cover-${id} shared-element target is in the DOM on back-navigation.
  // The morph from an article back to its list card can only pair if the
  // target card is already mounted when the View Transition snapshots — the
  // Suspense skeleton has no cover element, which silently degraded morph-back
  // into a fade-in. ISR (revalidate) prerenders the whole page anyway, so
  // streaming the feed bought nothing. Matches archive/category/tag pages.
  const [postsResult, guestbookResult, config] = await Promise.allSettled([
    getPostsByYear(currentYear, 50, 0),
    getBoardMessages('guestbook', guestbookConfig.previewLimit),
    getSiteConfig(),
  ])

  const posts: Post[] = postsResult.status === 'fulfilled' ? postsResult.value : []
  const fetchError = postsResult.status === 'rejected'

  // non-fatal: hero shows empty guestbook preview if this rejected
  let guestbookMessages: StickyStackPreviewMessage[] = []
  if (guestbookResult.status === 'fulfilled') {
    guestbookMessages = guestbookResult.value.map((message) => ({
      id: message.id,
      visual_seed: message.visual_seed,
      author: message.author,
      content: message.content,
      created_at: message.created_at,
      updated_at: message.updated_at,
    }))
  }

  const siteConfig = config.status === 'fulfilled' ? config.value : {}
  const live2dEngineUrl = siteConfig.live2d_engine_js_url || 'https://cdn.arthurlovegrace.top/js/live2d.js'

  return (
    <>
      {/* Preload the Cubism 2 core script so the browser starts downloading it
          during SSR/hydration rather than waiting for the Live2D component to mount. */}
      <link rel="preconnect" href="https://cdn.arthurlovegrace.top" />
      <link rel="preload" href={live2dEngineUrl} as="script" />
      <BlogPage
        posts={posts}
        fetchError={fetchError}
        currentYear={currentYear}
        initialGuestbookMessages={guestbookMessages}
        guestbookBoard={guestbookConfig}
      />
    </>
  )
}
