interface AuthorProfileCardProps {
  postsCount: number
  categoriesCount: number
  tagsCount: number
  name?: string
  bio?: string
  avatarUrl?: string
}

export default function AuthorProfileCard({
  postsCount,
  categoriesCount,
  tagsCount,
  name = 'Arthur & Grace',
  bio = '技术、生活与创意的记录者',
  avatarUrl,
}: AuthorProfileCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6">

      {/* Avatar */}
      <div className="flex justify-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-20 h-20 rounded-full object-cover shadow-[0_4px_16px_rgb(0,0,0,0.12)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[#1D1D1F] dark:bg-white flex items-center justify-center shadow-[0_4px_16px_rgb(0,0,0,0.12)]">
            <span className="text-white dark:text-[#1D1D1F] text-sm font-bold tracking-tight">A&G</span>
          </div>
        )}
      </div>

      {/* Name */}
      <h2 className="text-lg font-semibold mt-4 text-center text-[#1D1D1F] dark:text-white tracking-tight">
        {name}
      </h2>

      {/* Bio */}
      <p className="text-sm text-[#86868B] text-center mb-4 leading-relaxed mt-1">
        {bio}
      </p>

      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-zinc-800 mb-4" />

      {/* Stats */}
      <div className="flex items-center justify-around">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold text-[#1D1D1F] dark:text-white tabular-nums">{postsCount}</span>
          <span className="text-[11px] text-[#86868B] dark:text-zinc-500">文章</span>
        </div>
        <div className="w-px h-8 bg-gray-100 dark:bg-zinc-800" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold text-[#1D1D1F] dark:text-white tabular-nums">{categoriesCount}</span>
          <span className="text-[11px] text-[#86868B] dark:text-zinc-500">分类</span>
        </div>
        <div className="w-px h-8 bg-gray-100 dark:bg-zinc-800" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold text-[#1D1D1F] dark:text-white tabular-nums">{tagsCount}</span>
          <span className="text-[11px] text-[#86868B] dark:text-zinc-500">标签</span>
        </div>
      </div>

    </div>
  )
}
