import { getPostsByTags, getAllTags } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages, type NoteMessage } from '@/lib/note-boards'

export const revalidate = 60

export async function generateStaticParams() {
  const tags = await getAllTags().catch(() => [])
  return tags.map((t) => ({
    slug: t.tag,
  }))
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  const guestbookConfig = getNoteBoardConfig('guestbook')
  let posts: Post[] = []
  let guestbookMessages: NoteMessage[] = []
  let fetchError = false

  const [postsResult, guestbookResult] = await Promise.allSettled([
    getPostsByTags([decodedSlug], 50, 0),
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
      currentYear={getStableYear()}
      fetchError={fetchError}
      activeTags={[decodedSlug]}
      initialGuestbookMessages={guestbookMessages}
      guestbookBoard={guestbookConfig}
      slogan={{ text1: 'Tracing the threads', text2: 'Captured in tags' }}
    />

  )
}
