'use client'

import { memo } from 'react'
import { Link } from 'next-view-transitions'
import { useSiteData } from './SiteDataProvider'

interface CategoriesCardProps {
  activeCategory?: string | null
}

const CategoriesCard = memo(function CategoriesCard({ activeCategory }: CategoriesCardProps) {
  const { sidebarData: { categories } } = useSiteData()
  if (categories.length === 0) return null

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-border/50 dark:border-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-white/20 p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase mb-3">
        分类
      </h3>

      {/* Category list */}
      <ul className="space-y-1">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name
          return (
            <li key={cat.slug}>
              <Link
                href={isActive ? '/' : `/category/${cat.slug}`}
                className={`flex items-center justify-between py-1.5 px-1 rounded-lg transition-colors duration-150 group ${
                  isActive
                    ? 'bg-gradient-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <span className={`text-sm transition-colors ${
                  isActive
                    ? 'font-medium'
                    : 'text-foreground group-hover:text-primary'
                }`}>
                  {cat.name}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'bg-gradient-primary text-primary-foreground'
                    : 'bg-muted/30 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
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
})

export default CategoriesCard
