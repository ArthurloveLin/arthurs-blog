import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages, type NoteMessage } from '@/lib/note-boards'

export const revalidate = 1800

export default async function HomePage() {
  const currentYear = getStableYear()
  const guestbookConfig = getNoteBoardConfig('guestbook')
  let guestbookMessages: NoteMessage[] = []

  try {
    guestbookMessages = await getBoardMessages('guestbook', guestbookConfig.previewLimit)
  } catch {
    // non-fatal: hero shows empty guestbook preview
  }

  return (
    <BlogPage
      currentYear={currentYear}
      initialGuestbookMessages={guestbookMessages}
      guestbookBoard={guestbookConfig}
    />
  )
}
