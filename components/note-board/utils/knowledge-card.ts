import type { NoteCardViewModel } from '@/components/note-board/types'
import { parseHashtags } from '@/components/note-board/utils/editor'

export const KNOWLEDGE_CARD_TAG = '知识卡'

export function hasKnowledgeCardTag(content: string): boolean {
  return parseHashtags(content).includes(KNOWLEDGE_CARD_TAG)
}

export function isKnowledgeCardItem(item: NoteCardViewModel): boolean {
  return hasKnowledgeCardTag(item.message.content)
}

export function isKnowledgeCardFilterActive(activeTags: string[]): boolean {
  return activeTags.includes(KNOWLEDGE_CARD_TAG)
}
