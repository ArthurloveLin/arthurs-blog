import { getPostsByCategory, getCategories } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'

export const revalidate = false

function decodeCategorySlug(slug: string) {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

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
  const decodedSlug = decodeCategorySlug(slug)
  let posts: Post[] = []
  let fetchError = false

  try {
    posts = await getPostsByCategory(decodedSlug, 50, 0)
  } catch {
    fetchError = true
  }


  return (
    <BlogPage
      posts={posts}
      currentYear={getStableYear()}
      fetchError={fetchError}
      activeCategory={decodedSlug}
      slogan={{ text1: 'The soul of content', text2: 'Purely categorized' }}
    />

  )
}
