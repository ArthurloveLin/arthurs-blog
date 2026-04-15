import emojiData from '@emoji-mart/data'

export const COMMON_REACTION_EMOJIS = ['❤️', '😂', '😮', '🥹', '🔥', '👏'] as const

const CATEGORY_LABELS: Record<string, string> = {
  frequent: '常用',
  people: '表情与人物',
  nature: '自然',
  foods: '食物',
  activity: '活动',
  places: '地点',
  objects: '物品',
  symbols: '符号',
  flags: '旗帜',
}

interface EmojiMartSkin {
  native: string
}

interface EmojiMartEmoji {
  id: string
  name: string
  keywords?: string[]
  skins?: EmojiMartSkin[]
}

interface EmojiMartCategory {
  id: string
  emojis: string[]
}

interface EmojiMartData {
  categories: EmojiMartCategory[]
  emojis: Record<string, EmojiMartEmoji>
}

export interface EmojiOption {
  id: string
  emoji: string
  name: string
  keywords: string[]
  categoryId: string
  categoryLabel: string
}

export interface EmojiCategorySection {
  id: string
  label: string
  items: EmojiOption[]
}

const parsedEmojiData = emojiData as unknown as EmojiMartData

export const ALL_EMOJI_SECTIONS: EmojiCategorySection[] = parsedEmojiData.categories
  .map((category) => {
    const items = category.emojis
      .map((emojiId) => parsedEmojiData.emojis[emojiId])
      .filter((entry): entry is EmojiMartEmoji => Boolean(entry?.skins?.[0]?.native))
      .map((entry) => ({
        id: entry.id,
        emoji: entry.skins?.[0]?.native ?? '',
        name: entry.name,
        keywords: entry.keywords ?? [],
        categoryId: category.id,
        categoryLabel: CATEGORY_LABELS[category.id] ?? category.id,
      }))

    return {
      id: category.id,
      label: CATEGORY_LABELS[category.id] ?? category.id,
      items,
    }
  })
  .filter((section) => section.items.length > 0)

export function searchEmojiSections(query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return ALL_EMOJI_SECTIONS
  }

  return ALL_EMOJI_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const haystack = [item.name, item.id, ...item.keywords, item.categoryLabel].join(' ').toLowerCase()
        return haystack.includes(normalizedQuery)
      }),
    }))
    .filter((section) => section.items.length > 0)
}