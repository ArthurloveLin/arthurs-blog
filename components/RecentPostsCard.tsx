'use client'

import { memo } from 'react'
import Link from 'next/link'
import { useSiteData } from './SiteDataProvider'
import { formatShortDate } from '@/lib/date-format'

const RecentPostsCard = memo(function RecentPostsCard() {
  const { sidebarData: { recentPosts: posts } } = useSiteData()
  const recent = posts.slice(0, 5)
  if (recent.length === 0) return null

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-border/50 dark:border-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-white/20 p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase mb-3">
        最新文章
      </h3>

      {/* Post list */}
      <ul className="space-y-0.5">
        {recent.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog/${post.slug}`}
              className="block py-2 px-1 rounded-lg hover:bg-muted transition-colors duration-150 group"
            >
              <p className="text-sm text-foreground group-hover:text-primary transition-colors duration-150 leading-snug line-clamp-2">
                {post.title}
              </p>
              <time className="block text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                {post.published_at ? formatShortDate(post.published_at) : ''}
              </time>
            </Link>
          </li>
        ))}
      </ul>

    </div>
  )
})

export default RecentPostsCard
