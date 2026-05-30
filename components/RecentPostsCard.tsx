'use client'

import { memo } from 'react'
import Link from 'next/link'
import SidebarCard from './SidebarCard'
import { useRecentPosts } from './SiteDataProvider'
import { formatShortDate } from '@/lib/date-format'

const RecentPostsCard = memo(function RecentPostsCard() {
  const posts = useRecentPosts()
  const recent = posts.slice(0, 5)
  if (recent.length === 0) return null

  return (
    <SidebarCard title="最新文章">

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

    </SidebarCard>
  )
})

export default RecentPostsCard
