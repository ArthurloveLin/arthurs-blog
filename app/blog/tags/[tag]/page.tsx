import Link from 'next/link'
import { getPostsByTag } from '@/lib/blog'
import PostCard from '@/components/PostCard'

export const revalidate = 60

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)
  const posts = await getPostsByTag(decodedTag, 20, 0)

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8"
      >
        ← 返回
      </Link>

      <h1 className="text-2xl font-bold text-gray-800 mb-8">
        标签：<span className="text-gray-500 font-normal">{decodedTag}</span>
      </h1>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-sm py-12 text-center">该标签下暂无文章</p>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  )
}
