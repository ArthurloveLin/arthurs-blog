'use client'

import { Clock, Eye } from 'lucide-react'
import useSWR from 'swr'

interface PostCardStatsProps {
  slug: string
  readingMinutes: number
}

type AnalyticsResponse = { pageviews: number }

const fetcher = (url: string): Promise<AnalyticsResponse | null> =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<AnalyticsResponse>) : null))

function formatViews(n: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: n >= 10000 ? 1 : 0,
  }).format(n)
}

export default function PostCardStats({ slug, readingMinutes }: PostCardStatsProps) {
  const { data } = useSWR(
    `/api/analytics/post?path=${encodeURIComponent(`/blog/${slug}`)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60 * 1000 },
  )

  const minutes = Math.max(1, readingMinutes)

  return (
    <>
      <span className="text-foreground/20 font-bold select-none">·</span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
        <span>{minutes}&nbsp;min</span>
      </span>
      {typeof data?.pageviews === 'number' && (
        <>
          <span className="text-foreground/20 font-bold select-none">·</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Eye className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
            <span>{formatViews(data.pageviews)}&nbsp;次</span>
          </span>
        </>
      )}
    </>
  )
}
