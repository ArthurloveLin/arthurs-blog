import Link from 'next/link'
import type { Post } from '@/lib/blog'

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffTime = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`

  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Calculate reading time (approximate - see PRD for backend implementation)
function calculateReadingTime(summary?: string | null): string {
  if (!summary) return '3 min'
  const wordsPerMinute = 250 // Chinese characters count
  const charCount = summary.length
  const minutes = Math.ceil(charCount / wordsPerMinute)
  return `${minutes} min`
}

function getTagColor(tag: string): string {
  const colors = [
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  ]
  const index = tag.length % colors.length
  return colors[index]
}

export default function PostCard({ post }: { post: Post }) {
  const readingTime = calculateReadingTime(post.summary)

  return (
    <article className="group relative py-6 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-all duration-300 hover:border-gray-200 dark:hover:border-gray-700">
      <Link href={`/blog/${post.slug}`} className="group block">
        <div className="space-y-3">
          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.slice(0, 3).map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/tags/${encodeURIComponent(tag)}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors hover:opacity-80 ${getTagColor(tag)}`}
                >
                  {tag}
                </Link>
              ))}
              {post.tags.length > 3 && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  +{post.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-snug">
            {post.title}
          </h2>

          {/* Summary */}
          {post.summary && (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
              {post.summary}
            </p>
          )}

          {/* Footer with meta info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
            <time className="flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-400 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(post.published_at)}
            </time>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {readingTime} read
            </span>
          </div>
        </div>

        {/* Hover indicator */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="p-2 bg-violet-600 dark:bg-violet-500 rounded-full text-white shadow-lg transform group-hover:translate-x-0 translate-x-2 transition-transform duration-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    </article>
  )
}
