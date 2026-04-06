import { getPostsByCategory, getSiteConfig, getCategories } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'

export const revalidate = 60

export async function generateStaticParams() {
  const categories = await getCategories().catch(() => [])
  return categories.map((c) => ({
    slug: c.name,
  }))
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  let fetchError = false

  const [posts, siteConfig] = await Promise.all([
    getPostsByCategory(decodedSlug, 50, 0).catch(() => { fetchError = true; return [] as Post[] }),
    getSiteConfig().catch(() => ({} as Record<string, string>)),
  ])


  return (
    <BlogPage
      posts={posts}
      siteConfig={siteConfig}
      fetchError={fetchError}
      activeCategory={decodedSlug}
    />
  )
}
