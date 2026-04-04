interface Category {
  name: string
  count: number
  slug: string
}

interface CategoriesCardProps {
  categories: Category[]
}

export default function CategoriesCard({ categories }: CategoriesCardProps) {
  if (categories.length === 0) return null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-[#86868B] dark:text-zinc-500 uppercase mb-3">
        分类
      </h3>

      {/* Category list */}
      <ul className="space-y-1">
        {categories.map((cat) => (
          <li key={cat.slug}>
            <div className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 transition-colors duration-150 group cursor-pointer">
              <span className="text-sm text-[#1D1D1F] dark:text-zinc-300 group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors">
                {cat.name}
              </span>
              <span className="bg-[#F5F5F7] dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 rounded-full px-2 py-0.5 text-xs font-medium text-[#86868B] dark:text-zinc-400 tabular-nums transition-colors">
                {cat.count}
              </span>
            </div>
          </li>
        ))}
      </ul>

    </div>
  )
}
