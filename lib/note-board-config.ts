export type NoteBoardSlug = 'guestbook' | 'memo'

export interface NoteBoardViewConfig {
  slug: NoteBoardSlug
  title: string
  subtitle: string
  intro: string
  heroHint: string
  ctaLabel: string
  emptyLabel: string
  targetType: NoteBoardSlug
  targetId: string
  previewLimit: number
  initialPageLimit: number
  pageSize: number
}

const NOTE_BOARD_CONFIGS: Record<NoteBoardSlug, NoteBoardViewConfig> = {
  guestbook: {
    slug: 'guestbook',
    title: 'Guestbook',
    subtitle: '一张张贴在主页上的留言便签。',
    intro: '按时间倒序散开排列的公开留言板。拖开一张，就会露出下一张。',
    heroHint: '拖拽顶上的便签到主页区域任意位置，继续翻看下一张留言。',
    ctaLabel: '进入留言板',
    emptyLabel: '还没有留言，留下第一张便签吧。',
    targetType: 'guestbook',
    targetId: 'a0000000-0000-0000-0000-000000000001',
    previewLimit: 12,
    initialPageLimit: 48,
    pageSize: 24,
  },
  memo: {
    slug: 'memo',
    title: 'Memo',
    subtitle: '记录每日灵感。',
    intro: '以便签墙整理每日灵感，仅 admin 可以维护内容。',
    heroHint: 'Memo 仅在独立页面展开。',
    ctaLabel: '进入 Memo',
    emptyLabel: '暂时没有备忘录便签。',
    targetType: 'memo',
    targetId: 'a0000000-0000-0000-0000-000000000002',
    previewLimit: 12,
    initialPageLimit: 48,
    pageSize: 24,
  },
}

export function isNoteBoardSlug(value: string): value is NoteBoardSlug {
  return value in NOTE_BOARD_CONFIGS
}

export function getNoteBoardConfig(board: NoteBoardSlug) {
  return NOTE_BOARD_CONFIGS[board]
}
