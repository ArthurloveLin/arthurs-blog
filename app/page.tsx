import BlogPage from '@/components/BlogPage'
import type { StickyStackPreviewMessage } from '@/components/note-board/views/StickyStackPreview'
import { getStableYear } from '@/lib/date-format'
import { getNoteBoardConfig } from '@/lib/note-board-config'
import { getBoardMessages } from '@/lib/note-boards'

export const revalidate = 1800

export default async function HomePage() {
  const currentYear = getStableYear()
  const guestbookConfig = getNoteBoardConfig('guestbook')
  let guestbookMessages: StickyStackPreviewMessage[] = []

  try {
    const messages = await getBoardMessages('guestbook', guestbookConfig.previewLimit)
    guestbookMessages = messages.map((message) => ({
      id: message.id,
      visual_seed: message.visual_seed,
      author: message.author,
      content: message.content,
      created_at: message.created_at,
      updated_at: message.updated_at,
    }))
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
