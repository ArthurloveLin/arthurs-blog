import { getPostsByYear, getYearArchive } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages, type NoteMessage } from '@/lib/note-boards'

export const revalidate = 60

export async function generateStaticParams() {
  const archive = await getYearArchive().catch(() => [])
  return archive.map((a) => ({
    year: a.year.toString(),
  }))
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year } = await params
  const parsedYear = parseInt(year, 10)
  const guestbookConfig = getNoteBoardConfig('guestbook')
  let posts: Post[] = []
  let guestbookMessages: NoteMessage[] = []
  let fetchError = false

  const [postsResult, guestbookResult] = await Promise.allSettled([
    getPostsByYear(parsedYear, 50, 0),
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
      activeYear={parsedYear}
      initialGuestbookMessages={guestbookMessages}
      guestbookBoard={guestbookConfig}
    />
  )
}
