import type { StickyStackPreviewMessage } from '@/components/note-board/views/StickyStackPreview'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'

/**
 * Props shared by every hero variant. BlogHero (the dispatcher) fans these out to
 * whichever variant is active. Variants are free to ignore fields they don't use —
 * the terminal hero, for instance, renders stats/now-playing and ignores the
 * guestbook preview that the aurora hero builds its sticky-note stack from.
 */
export interface HeroVariantProps {
  guestbookBoard: NoteBoardViewConfig
  initialGuestbookMessages: StickyStackPreviewMessage[]
  slogan?: { text1: string; text2?: string }
}
