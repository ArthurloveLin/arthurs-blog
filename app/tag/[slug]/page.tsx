import { getPostsByTags, getSiteConfig, getAllTags } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'

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

  const [posts, siteConfig] = await Promise.all([
    getPostsByTags([decodedSlug], 50, 0).catch(() => { fetchError = true; return [] as Post[] }),
    getSiteConfig().catch(() => ({} as Record<string, string>)),
  ])


  return (
    <BlogPage
      posts={posts}
      siteConfig={siteConfig}
      fetchError={fetchError}
      activeTags={[decodedSlug]}
    />
  )
}
