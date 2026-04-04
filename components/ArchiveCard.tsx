import Link from 'next/link'

interface YearGroup {
  year: number
  count: number
}

interface ArchiveCardProps {
  archive: YearGroup[]
  activeYear?: number | null
}

export default function ArchiveCard({ archive, activeYear }: ArchiveCardProps) {
  if (archive.length === 0) return null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-[#86868B] dark:text-zinc-500 uppercase mb-3">
        归档
      </h3>

      {/* Year list */}
      <ul className="space-y-0.5">
        {archive.map(({ year, count }) => {
          const isActive = activeYear === year
          return (
            <li key={year}>
              <Link
                href={isActive ? '/' : `/?year=${year}`}
                className={`flex items-center justify-between py-1.5 px-1 rounded-lg transition-colors duration-150 group ${
                  isActive
                    ? 'bg-[#1D1D1F] dark:bg-zinc-100'
                    : 'hover:bg-[#F5F5F7] dark:hover:bg-zinc-800'
                }`}
              >
                <span className={`text-sm font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'text-white dark:text-zinc-900'
                    : 'text-[#1D1D1F] dark:text-zinc-300 group-hover:text-violet-600 dark:group-hover:text-violet-400'
                }`}>
                  {year}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900'
                    : 'bg-[#F5F5F7] dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 text-[#86868B] dark:text-zinc-400'
                }`}>
                  {count} 篇
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

    </div>
  )
}
