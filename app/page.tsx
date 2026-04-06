import { getPostsByYear, getSiteConfig } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'

export const revalidate = 60

export default async function HomePage() {
  const currentYear = new Date().getFullYear()
  let fetchError = false

  const [posts, siteConfig] = await Promise.all([
    getPostsByYear(currentYear, 50, 0).catch(() => { fetchError = true; return [] as Post[] }),
    getSiteConfig().catch(() => ({} as Record<string, string>)),
  ])


  return (
    <BlogPage
      posts={posts}
      siteConfig={siteConfig}
      fetchError={fetchError}
    />
  )
}
