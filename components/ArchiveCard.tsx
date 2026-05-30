'use client'

import { memo } from 'react'
import Link from 'next/link'
import SidebarCard from './SidebarCard'
import { useSiteArchive } from './SiteDataProvider'

interface ArchiveCardProps {
  activeYear?: number | null
}

const ArchiveCard = memo(function ArchiveCard({ activeYear }: ArchiveCardProps) {
  const archive = useSiteArchive()
  if (archive.length === 0) return null

  return (
    <SidebarCard title="归档">

      {/* Year list */}
      <ul className="space-y-0.5">
        {archive.map(({ year, count }) => {
          const isActive = activeYear === year
          return (
            <li key={year}>
              <Link
                href={isActive ? '/' : `/archive/${year}`}
                className={`flex items-center justify-between py-1.5 px-1 rounded-lg transition-colors duration-150 group ${
                  isActive
                    ? 'bg-gradient-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <span className={`text-sm font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-foreground group-hover:text-primary'
                }`}>
                  {year}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'bg-gradient-primary text-primary-foreground'
                    : 'bg-muted/30 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                }`}>
                  {count} 篇
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

    </SidebarCard>
  )
})

export default ArchiveCard
