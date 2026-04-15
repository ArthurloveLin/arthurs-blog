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
    <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-muted/40 p-1 sm:w-auto sm:flex-nowrap">
      <button
        onClick={() => setView('all')}
        className={`flex-1 rounded-xl px-4 py-2 text-[11px] font-bold tracking-[0.16em] transition-all active:scale-95 sm:flex-none sm:text-xs ${
          current !== 'final'
            ? 'bg-foreground text-background shadow-md'
            : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
        }`}
      >
        全部
      </button>
      <button
        onClick={() => setView('final')}
        className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-[11px] font-bold tracking-[0.12em] transition-all active:scale-95 sm:flex-none sm:text-xs ${
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
