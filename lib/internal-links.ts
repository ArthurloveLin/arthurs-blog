export interface InternalLinkItem {
  id: string
  href: string
  title: string
  summary: string
  tags: string[]
  category: string
}

export const INTERNAL_SEARCH_ITEMS: InternalLinkItem[] = [
  {
    id: 'internal-life-gallery',
    href: '/life-gallery',
    title: 'Life Gallery',
    summary: "我的生活画廊与轮播图集 - Arthur's Blog 的生活瞬间",
    tags: ['生活', '画廊', '图集', 'Gallery', 'Photo', '展示'],
    category: '站内工具',
  },
  {
    id: 'internal-news',
    href: '/trend-radar',
    title: 'News',
    summary: '趋势雷达 - 每日行业热点与资讯聚合汇总',
    tags: ['趋势', '资讯', 'News', 'Trend', 'Radar', '聚合', '行业'],
    category: '站内工具',
  },
  {
    id: 'internal-message',
    href: '/guestbook',
    title: 'Message',
    summary: "留言板 - 留下你的印记，与 Arthur's Blog 互动",
    tags: ['留言', '便签', 'Guestbook', 'Message', 'Board', '互动'],
    category: '站内工具',
  },
  {
    id: 'internal-memo',
    href: '/memo',
    title: 'Memo',
    summary: '灵感记录 - 随手记下的点滴灵感与想法',
    tags: ['灵感', '笔记', 'Memo', 'Note', 'Inspiration', '想法'],
    category: '站内工具',
  },
  {
    id: 'internal-now-watching',
    href: '/now-watching',
    title: 'Now Watching',
    summary: '电影动态 - 最近看过的电影海报与流媒体记录',
    tags: ['电影', '海报', 'Movie', 'Film', 'Watch', '纪录'],
    category: '站内工具',
  },
]
