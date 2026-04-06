'use client'

import { memo } from 'react'
import { Link } from 'next-view-transitions'
import { useSiteData } from './SiteDataProvider'

interface TagsCloudCardProps {
  activeTags?: string[]
}

function buildTagsUrl(activeTags: string[], toggleTag: string): string {
  const isActive = activeTags.includes(toggleTag)
  if (isActive) return '/'
  return `/tag/${toggleTag}`
}

const TagsCloudCard = memo(function TagsCloudCard({ activeTags = [] }: TagsCloudCardProps) {
  const { sidebarData: { tags } } = useSiteData()
  if (tags.length === 0) return null

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-border/50 dark:border-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-white/20 p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase mb-3">
        标签
      </h3>

      {/* Tags cloud */}
      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, count }) => {
          const isActive = activeTags.includes(tag)
          return (
            <Link
              key={tag}
              href={buildTagsUrl(activeTags, tag)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition duration-200 ${
                isActive
                  ? 'bg-gradient-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tag}
              <span className={`text-[10px] tabular-nums ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{count}</span>
            </Link>
          )
        })}
      </div>

    </div>
  )
})

export default TagsCloudCard
