import { getPostsByYear, getSiteConfig, getYearArchive } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'

export const revalidate = 60

export async function generateStaticParams() {
  const archive = await getYearArchive().catch(() => [])
  return archive.map((a) => ({
    year: a.year.toString(),
  }))
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year } = await params
  const parsedYear = parseInt(year, 10)
  let fetchError = false

  const [posts, siteConfig] = await Promise.all([
    getPostsByYear(parsedYear, 50, 0).catch(() => { fetchError = true; return [] as Post[] }),
    getSiteConfig().catch(() => ({} as Record<string, string>)),
  ])


  return (
    <BlogPage
      posts={posts}
      siteConfig={siteConfig}
      fetchError={fetchError}
      activeYear={parsedYear}
    />
  )
}
