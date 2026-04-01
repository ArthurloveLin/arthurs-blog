'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const SORTS = [
  { value: 'time', label: '时间' },
  { value: 'rating', label: '综合评分' },
  { value: 'arthur', label: 'Arthur' },
  { value: 'grace', label: 'Grace' },
  { value: 'price', label: '价格' },
]

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
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400">排序：</span>
      {SORTS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setSort(value)}
          className={`px-3 py-1 rounded-full text-xs transition-colors ${
            current === value
              ? 'bg-pink-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
