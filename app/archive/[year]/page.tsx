import { getPostsByYear, getYearArchive } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import BlogPage from '@/components/BlogPage'
import { getStableYear } from '@/lib/date-format'

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
  let posts: Post[] = []
  let fetchError = false

  try {
    posts = await getPostsByYear(parsedYear, 50, 0)
  } catch {
    fetchError = true
  }


  return (
    <BlogPage
      posts={posts}
      currentYear={getStableYear()}
      fetchError={fetchError}
      activeYear={parsedYear}
    />
  )
}
