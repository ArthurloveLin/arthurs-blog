'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function SortControl({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sort)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400 self-center">排序：</span>
      <button
        onClick={() => setSort('time')}
        className={`px-3 py-1 rounded-full transition-colors ${
          current === 'time'
            ? 'bg-pink-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        上传时间
      </button>
      <button
        onClick={() => setSort('rating')}
        className={`px-3 py-1 rounded-full transition-colors ${
          current === 'rating'
            ? 'bg-pink-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        评分
      </button>
    </div>
  )
}
