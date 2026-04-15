'use client'

import { BookOpenText, Eye } from 'lucide-react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'

interface ArticleMetaStatsProps {
  readingMinutes: number
}

type AnalyticsResponse = {
  pageviews: number
}

const fetcher = async (url: string): Promise<AnalyticsResponse | null> => {
  const response = await fetch(url)
  if (!response.ok) {
    return null
  }

  return response.json() as Promise<AnalyticsResponse>
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value)
}

export default function ArticleMetaStats({ readingMinutes }: ArticleMetaStatsProps) {
  const pathname = usePathname()
  const { data, isLoading } = useSWR(pathname ? `/api/analytics/post?path=${encodeURIComponent(pathname)}` : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  })

  const pageviewsLabel = isLoading
    ? '浏览量加载中'
    : typeof data?.pageviews === 'number'
      ? `${formatCompactNumber(data.pageviews)} 次浏览`
      : '浏览量暂不可用'

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm">
        <BookOpenText size={13} strokeWidth={1.9} />
        <span>预计 {Math.max(1, readingMinutes)} 分钟读完</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm">
        <Eye size={13} strokeWidth={1.9} />
        <span>{pageviewsLabel}</span>
      </span>
    </div>
  )
}