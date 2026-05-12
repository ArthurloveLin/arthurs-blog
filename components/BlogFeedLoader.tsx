import { getPostsByYear } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogFeedSection from '@/components/BlogFeedSection'

interface BlogFeedLoaderProps {
  currentYear: number
  activeCategory?: string | null
  activeTags?: string[]
  activeYear?: number | null
}

export default async function BlogFeedLoader({
  currentYear,
  activeCategory = null,
  activeTags = [],
  activeYear = null,
}: BlogFeedLoaderProps) {
  let posts: Post[] = []
  let fetchError = false
  try {
    posts = await getPostsByYear(currentYear, 50, 0)
  } catch {
    fetchError = true
  }
  return (
    <BlogFeedSection
      posts={posts}
      fetchError={fetchError}
      activeCategory={activeCategory}
      activeTags={activeTags}
      activeYear={activeYear}
    />
  )
}
