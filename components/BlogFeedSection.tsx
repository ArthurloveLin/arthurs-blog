'use client'

import Link from 'next/link'
import { ViewTransition } from 'react'
import type { Post } from '@/lib/blog'
import PostCard, { EagerPostCard } from '@/components/PostCard'
import AdminOnly from '@/components/AdminOnly'
import ReindexButton from '@/components/ReindexButton'

interface BlogFeedSectionProps {
  posts: Post[]
  returningPostSlug: string | null
  fetchError?: boolean
  activeCategory?: string | null
  activeTags?: string[]
  activeYear?: number | null
}

function getPostCardComponent(isReturningPost: boolean) {
  return isReturningPost ? EagerPostCard : PostCard
}

export default function BlogFeedSection({
  posts,
  returningPostSlug,
  fetchError = false,
  activeCategory = null,
  activeTags = [],
  activeYear = null,
}: BlogFeedSectionProps) {
  return (
    <section className="min-w-0 md:col-span-8 lg:col-span-1">
      {/* Feed header / Category filter banner */}
      <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl bg-card border border-border shadow-[3px_5px_30px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[3px_8px_36px_rgba(0,0,0,0.12)]">
        {activeCategory || activeTags.length > 0 || activeYear ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              {activeCategory ? '分类' : activeTags.length > 0 ? '标签' : '归档'}
            </span>
            <span className="text-sm font-medium text-foreground">
              {activeCategory ?? (activeTags.length > 0 ? activeTags.join(' + ') : `${activeYear} 年`)}
            </span>
            <span className="text-xs text-muted-foreground">· 共 {posts.length} 篇</span>
            <Link
              href="/"
              className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </Link>
          </div>
        ) : (
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
            {posts.length > 0 ? `${posts.length} 篇文章` : '文章'}
          </span>
        )}
        <AdminOnly>
          <ReindexButton />
        </AdminOnly>
      </div>

      {/* Empty / error state */}
      {posts.length === 0 && (
        <div className="py-24 flex flex-col items-center gap-2">
          <span className="font-mono text-xs text-zinc-300 dark:text-zinc-700">
            {fetchError ? '— 加载失败 —' : '— 暂无文章 —'}
          </span>
          <span className="text-xs text-muted-foreground">
            {fetchError
              ? '数据库连接异常，请刷新重试'
              : activeCategory
              ? '该分类下暂无文章'
              : activeTags.length > 0
              ? '该标签下暂无文章'
              : activeYear
              ? `${activeYear} 年暂无归档文章`
              : '点击同步按钮获取最新内容'}
          </span>
        </div>
      )}

      {/* Post cards */}
      {posts.length > 0 && (
        <div className="space-y-6">
          {posts.map((post, index) => {
            const CardComponent = getPostCardComponent(returningPostSlug === post.slug)

            return (
              <ViewTransition key={post.id}>
                <CardComponent post={post} index={index} />
              </ViewTransition>
            )
          })}
        </div>
      )}
    </section>
  )
}
