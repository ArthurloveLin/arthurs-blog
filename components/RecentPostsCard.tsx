import Link from 'next/link'
import type { Post } from '@/lib/blog'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface RecentPostsCardProps {
  posts: Post[]
}

export default function RecentPostsCard({ posts }: RecentPostsCardProps) {
  const recent = posts.slice(0, 5)
  if (recent.length === 0) return null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-[#86868B] dark:text-zinc-500 uppercase mb-3">
        最新文章
      </h3>

      {/* Post list */}
      <ul className="space-y-0.5">
        {recent.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog/${post.slug}`}
              className="block py-2 px-1 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 transition-colors duration-150 group"
            >
              <p className="text-sm text-[#1D1D1F] dark:text-zinc-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors duration-150 leading-snug line-clamp-2">
                {post.title}
              </p>
              <time className="block text-[11px] text-[#86868B] dark:text-zinc-600 mt-0.5 tabular-nums">
                {formatDate(post.published_at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>

    </div>
  )
}
