import Link from 'next/link'

interface TagsCloudCardProps {
  tags: { tag: string; count: number }[]
}

export default function TagsCloudCard({ tags }: TagsCloudCardProps) {
  if (tags.length === 0) return null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-[#86868B] dark:text-zinc-500 uppercase mb-3">
        标签
      </h3>

      {/* Tags cloud */}
      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/blog/tags/${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F7] dark:bg-zinc-800 px-3 py-1 text-sm text-[#1D1D1F] dark:text-zinc-300 hover:bg-[#1D1D1F] hover:text-white dark:hover:bg-white dark:hover:text-[#1D1D1F] transition-all duration-200"
          >
            {tag}
            <span className="text-[10px] text-[#86868B] dark:text-zinc-500 tabular-nums">{count}</span>
          </Link>
        ))}
      </div>

    </div>
  )
}
