import Link from 'next/link'

const modules = [
  {
    href: '/wardrobe',
    emoji: '👗',
    title: '选衣记录',
    description: '批量上传衣物、双人评分决策、管理每月购衣清单',
    color: 'from-pink-50 to-rose-50',
    border: 'border-pink-100',
    badge: 'bg-pink-100 text-pink-600',
    badgeText: '使用中',
    active: true,
  },
  {
    href: '#',
    emoji: '📰',
    title: '新闻汇总',
    description: '聚合多源资讯，每日快览科技、财经、生活热点',
    color: 'from-sky-50 to-blue-50',
    border: 'border-sky-100',
    badge: 'bg-gray-100 text-gray-400',
    badgeText: '即将上线',
    active: false,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-4 py-16 flex flex-col flex-1">

        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-4xl mb-4">🏠</p>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Arthur & Grace</h1>
          <p className="text-gray-400 mt-2 text-sm">小工具合集，让生活更有趣</p>
        </div>

        {/* Module Cards */}
        <div className="flex flex-col gap-4">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`
                group relative rounded-2xl border bg-gradient-to-br p-5
                ${mod.color} ${mod.border}
                ${mod.active
                  ? 'shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-150 cursor-pointer'
                  : 'opacity-60 cursor-not-allowed pointer-events-none'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-3xl leading-none mt-0.5">{mod.emoji}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 leading-tight">{mod.title}</h2>
                    <p className="text-gray-500 text-sm mt-1 leading-relaxed">{mod.description}</p>
                  </div>
                </div>
                <span className={`shrink-0 ml-3 text-xs font-medium px-2.5 py-1 rounded-full ${mod.badge}`}>
                  {mod.badgeText}
                </span>
              </div>
              {mod.active && (
                <div className="absolute right-5 bottom-5 text-gray-300 group-hover:text-gray-400 transition-colors text-lg">
                  →
                </div>
              )}
            </Link>
          ))}
        </div>

      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-300 pb-8">Made with ♥</p>
    </main>
  )
}
