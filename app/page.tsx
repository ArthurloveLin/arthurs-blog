import { getPosts } from '@/lib/blog'
import PostCard from '@/components/PostCard'
import ReindexButton from '@/components/ReindexButton'

export const revalidate = 60

export default async function HomePage() {
  const posts = await getPosts(20, 0)

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">最近文章</h1>
        <ReindexButton />
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-sm py-12 text-center">还没有发布的文章</p>
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
