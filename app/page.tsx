import { getPostsByYear } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'

export const revalidate = 1800

export default async function HomePage() {
  const currentYear = getStableYear()
  let posts: Post[] = []
  let fetchError = false

  try {
    posts = await getPostsByYear(currentYear, 50, 0)
  } catch {
    fetchError = true
  }


  return (
    <BlogPage
      posts={posts}
      currentYear={currentYear}
      fetchError={fetchError}
    />
  )
}
