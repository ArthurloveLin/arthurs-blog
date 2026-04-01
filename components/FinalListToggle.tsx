'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function FinalListToggle({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setView(view: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setView('all')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          current !== 'final'
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        全部
      </button>
      <button
        onClick={() => setView('final')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          current === 'final'
            ? 'bg-green-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        ✓ 最终清单
      </button>
    </div>
  )
}
