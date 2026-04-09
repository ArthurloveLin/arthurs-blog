import { getPostsByCategory, getCategories } from '@/lib/blog'
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

  // async-parallel: single fetch needs no Promise.all wrapper
  const posts = await getPostsByCategory(decodedSlug, 50, 0).catch(() => { fetchError = true; return [] as Post[] })


  return (
    <BlogPage
      posts={posts}
      fetchError={fetchError}
      activeCategory={decodedSlug}
    />
  )
}
