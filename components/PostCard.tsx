import Link from 'next/link'
import type { Post } from '@/lib/blog'

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return time === '00:00' ? date : `${date} ${time}`
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="py-6 border-b border-gray-100 last:border-0">
      <Link href={`/blog/${post.slug}`} className="group block">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-800 group-hover:text-gray-600 transition-colors leading-snug">
            {post.title}
          </h2>
          <time className="shrink-0 text-sm text-gray-400 mt-0.5">
            {formatDate(post.published_at)}
          </time>
        </div>
        {post.summary && (
          <p className="mt-2 text-sm text-gray-500 leading-relaxed line-clamp-2">
            {post.summary}
          </p>
        )}
        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
    </article>
  )
}
