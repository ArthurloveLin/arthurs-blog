'use client'

import { memo } from 'react'
import { Link } from 'next-view-transitions'
import { useSiteData } from './SiteDataProvider'

interface ArchiveCardProps {
  activeYear?: number | null
}

const ArchiveCard = memo(function ArchiveCard({ activeYear }: ArchiveCardProps) {
  const { sidebarData: { yearArchive: archive } } = useSiteData()
  if (archive.length === 0) return null

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-border/50 dark:border-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-white/20 p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase mb-3">
        归档
      </h3>

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

    </div>
  )
})

export default ArchiveCard
