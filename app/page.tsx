import { getPostsByYear } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'

export const revalidate = 60

export default async function HomePage() {
  const currentYear = getStableYear()
  let fetchError = false

  // async-parallel: single fetch needs no Promise.all wrapper
  const posts = await getPostsByYear(currentYear, 50, 0).catch(() => { fetchError = true; return [] as Post[] })


  return (
    <BlogPage
      posts={posts}
      currentYear={currentYear}
      fetchError={fetchError}
    />
  )
}
