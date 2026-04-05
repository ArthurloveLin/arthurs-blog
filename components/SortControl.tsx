'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const SORTS = [
  { value: 'time', label: '时间' },
  { value: 'rating', label: '综合评分' },
  { value: 'arthur', label: 'Arthur' },
  { value: 'grace', label: 'Grace' },
  { value: 'price', label: '价格' },
  { value: 'position', label: '手动排序' },
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
      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/50">排序：</span>
      {SORTS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setSort(value)}
          className={`px-3 py-1 rounded-full text-xs transition-all active:scale-95 ${
            current === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
