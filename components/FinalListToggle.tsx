'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'

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
        className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
          current !== 'final'
            ? 'bg-foreground text-background shadow-md'
            : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
        }`}
      >
        全部
      </button>
      <button
        onClick={() => setView('final')}
        className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
          current === 'final'
            ? 'bg-green-600 text-white shadow-md'
            : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
        }`}
      >
        ✓ 最终清单
      </button>
    </div>
  )
}
