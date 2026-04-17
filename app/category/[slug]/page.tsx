import { getPostsByCategory, getCategories } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages, type NoteMessage } from '@/lib/note-boards'

export const revalidate = 60

function decodeCategorySlug(slug: string) {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

export async function generateStaticParams() {
  const categories = await getCategories().catch(() => [])
  return categories.map((c) => ({
    slug: c.name,
  }))
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const decodedSlug = decodeCategorySlug(slug)
  const guestbookConfig = getNoteBoardConfig('guestbook')
  let posts: Post[] = []
  let guestbookMessages: NoteMessage[] = []
  let fetchError = false

  const [postsResult, guestbookResult] = await Promise.allSettled([
    getPostsByCategory(decodedSlug, 50, 0),
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
      activeCategory={decodedSlug}
      initialGuestbookMessages={guestbookMessages}
      guestbookBoard={guestbookConfig}
    />
  )
}
