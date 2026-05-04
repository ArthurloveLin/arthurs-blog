import { getPostsByYear } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages, type NoteMessage } from '@/lib/note-boards'

export const revalidate = 1800

export default async function HomePage() {
  const currentYear = getStableYear()
  const guestbookConfig = getNoteBoardConfig('guestbook')
  let posts: Post[] = []
  let guestbookMessages: NoteMessage[] = []
  let fetchError = false

  const [postsResult, guestbookResult] = await Promise.allSettled([
    getPostsByYear(currentYear, 50, 0),
    getBoardMessages('guestbook', guestbookConfig.previewLimit),
  ])

  if (postsResult.status === 'fulfilled') {
    posts = postsResult.value
  } else {
    fetchError = true
  }

  if (guestbookResult.status === 'fulfilled') {
    guestbookMessages = guestbookResult.value
  }


  return (
    <BlogPage
      posts={posts}
      currentYear={currentYear}
      fetchError={fetchError}
      initialGuestbookMessages={guestbookMessages}
      guestbookBoard={guestbookConfig}
    />
  )
}
