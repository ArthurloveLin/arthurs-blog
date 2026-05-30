'use client'

import { memo } from 'react'
import Link from 'next/link'
import SidebarCard from './SidebarCard'
import { useSiteCategories } from './SiteDataProvider'

interface CategoriesCardProps {
  activeCategory?: string | null
}

const CategoriesCard = memo(function CategoriesCard({ activeCategory }: CategoriesCardProps) {
  const categories = useSiteCategories()
  if (categories.length === 0) return null

  return (
    <SidebarCard title="分类">

      {/* Category list */}
      <ul className="space-y-1">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name
          return (
            <li key={cat.slug}>
              <Link
                href={isActive ? '/' : `/category/${cat.slug}`}
                scroll={false}
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

    </SidebarCard>
  )
})

export default CategoriesCard
