'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Plus } from 'lucide-react'

function buildDraftSlug() {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')

  return `draft-${stamp}`
}

export default function RecipeAddButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setError(null)

    const response = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '未命名菜谱',
        slug: buildDraftSlug(),
        version: '1.0',
        description: '',
        tags: [],
        suitable_occasions: [],
        ingredients: [],
        steps: [],
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: '创建失败，请稍后重试。' }))
      setError(typeof payload?.error === 'string' ? payload.error : '创建失败，请稍后重试。')
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-amber-800/20 bg-amber-50/65 p-3 shadow-[0_12px_28px_rgba(120,73,25,0.08)]">
      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-amber-900/55">管理员</p>
      <h3 className="mt-1 text-sm font-semibold text-amber-950">新增菜谱草稿</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900/65">
        新建后会出现在当前书册里，直接翻到新页面即可继续编辑。
      </p>
      <button
        type="button"
        onClick={handleCreate}
        disabled={isPending}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-900/15 bg-white px-3 py-1.5 text-[11px] font-medium text-amber-950 transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(120,73,25,0.12)] disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {isPending ? '创建中...' : '新增一页'}
      </button>
      {error && <p className="mt-2 text-[10px] leading-relaxed text-red-700">{error}</p>}
    </div>
  )
}