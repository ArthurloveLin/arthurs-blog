function PostCardSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="aspect-[2.4/1] bg-muted animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="h-3 bg-muted animate-pulse rounded w-16" />
          <div className="h-3 bg-muted animate-pulse rounded w-12" />
        </div>
      </div>
    </div>
  )
}

export default function BlogFeedSkeleton() {
  return (
    <section className="min-w-0 md:col-span-8 lg:col-span-1">
      <span className="sr-only">加载中…</span>
      <div aria-hidden="true" className="h-12 mb-5 animate-pulse rounded-xl bg-muted" />
      <div className="space-y-6">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </section>
  )
}
