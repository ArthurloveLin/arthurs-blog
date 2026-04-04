import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/lib/blog'

// Soft editorial gradients — cycled by index for visual variety
const COVER_GRADIENTS = [
  'from-[#E8EAF6] via-[#C5CAE9] to-[#9FA8DA]',
  'from-[#E0F2F1] via-[#B2DFDB] to-[#80CBC4]',
  'from-[#FCE4EC] via-[#F8BBD0] to-[#F48FB1]',
  'from-[#FFF8E1] via-[#FFE082] to-[#FFD54F]',
  'from-[#E8F5E9] via-[#C8E6C9] to-[#A5D6A7]',
  'from-[#E3F2FD] via-[#BBDEFB] to-[#90CAF9]',
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface PostCardProps {
  post: Post
  index?: number
  commentCount?: number
}

export default function PostCard({ post, index = 0, commentCount }: PostCardProps) {
  const gradient = COVER_GRADIENTS[index % COVER_GRADIENTS.length]
  const date = formatDate(post.published_at)

  // 解码一次，避免 DB 中已编码的 URL（如 %7B）被 next/image 二次编码成 %257B
  const coverSrc = post.cover_image ? decodeURIComponent(post.cover_image) : null
  // obsidian 自建服务响应慢，跳过服务端代理让浏览器直连；同时解决 {} 文件名问题
  const unoptimized = coverSrc?.includes('obsidian.arthurlovegrace.top') ?? false

  return (
    <article className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden group relative">

      {/* ── Cover Image ────────────────────────────────────────────── */}
      <Link href={`/blog/${post.slug}`} className="relative block h-48 w-full overflow-hidden" tabIndex={-1} aria-hidden>
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={index === 0}
            unoptimized={unoptimized}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient} transition-transform duration-500 group-hover:scale-105`} />
        )}
      </Link>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="p-6">

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                href={`/blog/tags/${encodeURIComponent(tag)}`}
                className="relative z-10 font-mono text-[10px] tracking-wide px-2 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-zinc-800 text-[#86868B] dark:text-zinc-400 hover:bg-[#1D1D1F] hover:text-white dark:hover:bg-white dark:hover:text-[#1D1D1F] transition-all duration-200"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Title */}
        <h2 className="text-lg font-bold text-[#1D1D1F] dark:text-white mb-2 leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors duration-200">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>

        {/* Excerpt */}
        {post.summary && (
          <p className="text-[#86868B] dark:text-zinc-400 text-sm mb-4 line-clamp-2 leading-relaxed">
            {post.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <time
              dateTime={post.published_at ?? ''}
              className="text-xs text-[#86868B] dark:text-zinc-500 tabular-nums"
            >
              {date}
            </time>
            {commentCount !== undefined && commentCount > 0 && (
              <span className="text-xs text-[#86868B] dark:text-zinc-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
                </svg>
                {commentCount}
              </span>
            )}
          </div>
          <span className="relative z-10 text-xs font-medium text-[#1D1D1F] dark:text-zinc-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors duration-200 flex items-center gap-1">
            阅读全文
            <svg className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>

      </div>
    </article>
  )
}
