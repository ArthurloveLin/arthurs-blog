import type { Post } from '@/lib/blog'

interface YearGroup {
  year: number
  count: number
}

function groupByYear(posts: Post[]): YearGroup[] {
  const yearMap = new Map<number, number>()
  posts.forEach((post) => {
    if (!post.published_at) return
    const year = new Date(post.published_at).getFullYear()
    yearMap.set(year, (yearMap.get(year) ?? 0) + 1)
  })
  return Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year)
}

interface ArchiveCardProps {
  posts: Post[]
}

export default function ArchiveCard({ posts }: ArchiveCardProps) {
  const archive = groupByYear(posts)
  if (archive.length === 0) return null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-[#86868B] dark:text-zinc-500 uppercase mb-3">
        归档
      </h3>

      {/* Year list */}
      <ul className="space-y-0.5">
        {archive.map(({ year, count }) => (
          <li key={year}>
            <div className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 transition-colors duration-150 cursor-pointer group">
              <span className="text-sm font-medium text-[#1D1D1F] dark:text-zinc-300 tabular-nums group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                {year}
              </span>
              <span className="bg-[#F5F5F7] dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 rounded-full px-2 py-0.5 text-xs font-medium text-[#86868B] dark:text-zinc-400 tabular-nums transition-colors">
                {count} 篇
              </span>
            </div>
          </li>
        ))}
      </ul>

    </div>
  )
}
