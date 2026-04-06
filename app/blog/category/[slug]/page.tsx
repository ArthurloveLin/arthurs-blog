import { getPostsByCategory } from '@/lib/blog'
import PostCard from '@/components/PostCard'
import BackButton from '@/components/BackButton'

export const revalidate = 60

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const decodedCategory = decodeURIComponent(slug)
  const posts = await getPostsByCategory(decodedCategory, 20, 0)

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <BackButton />

      <h1 className="text-2xl font-bold text-gray-800 mb-8">
        分类：<span className="text-gray-500 font-normal">{decodedCategory}</span>
      </h1>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-sm py-12 text-center">该分类下暂无文章</p>
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
