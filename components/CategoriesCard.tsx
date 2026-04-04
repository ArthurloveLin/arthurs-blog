import Link from 'next/link'

interface Category {
  name: string
  count: number
  slug: string
}

interface CategoriesCardProps {
  categories: Category[]
  activeCategory?: string | null
}

export default function CategoriesCard({ categories, activeCategory }: CategoriesCardProps) {
  if (categories.length === 0) return null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-[#86868B] dark:text-zinc-500 uppercase mb-3">
        分类
      </h3>

      {/* Category list */}
      <ul className="space-y-1">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name
          return (
            <li key={cat.slug}>
              <Link
                href={isActive ? '/' : `/?category=${cat.slug}`}
                className={`flex items-center justify-between py-1.5 px-1 rounded-lg transition-colors duration-150 group ${
                  isActive
                    ? 'bg-[#1D1D1F] dark:bg-zinc-100'
                    : 'hover:bg-[#F5F5F7] dark:hover:bg-zinc-800'
                }`}
              >
                <span className={`text-sm transition-colors ${
                  isActive
                    ? 'text-white dark:text-zinc-900 font-medium'
                    : 'text-[#1D1D1F] dark:text-zinc-300 group-hover:text-[#1D1D1F] dark:group-hover:text-white'
                }`}>
                  {cat.name}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900'
                    : 'bg-[#F5F5F7] dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 text-[#86868B] dark:text-zinc-400'
                }`}>
                  {cat.count}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

    </div>
  )
}
