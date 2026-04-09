import { getPostsByTags, getAllTags } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'

export const revalidate = 60

export async function generateStaticParams() {
  const tags = await getAllTags().catch(() => [])
  return tags.map((t) => ({
    slug: t.tag,
  }))
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  let fetchError = false

  // async-parallel: single fetch needs no Promise.all wrapper
  const posts = await getPostsByTags([decodedSlug], 50, 0).catch(() => { fetchError = true; return [] as Post[] })


  return (
    <BlogPage
      posts={posts}
      currentYear={getStableYear()}
      fetchError={fetchError}
      activeTags={[decodedSlug]}
    />
  )
}
