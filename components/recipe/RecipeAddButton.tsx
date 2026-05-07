'use client'

import { useTransition, useState } from 'react'
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
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCreate() {
    setError(null)

    startTransition(async () => {
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

      window.location.reload()
    })
  }

  return (
    <div className="bs-control-bookmarks">
      <button
        type="button"
        className="bs-control-bookmark"
        data-variant="success"
        onClick={handleCreate}
        disabled={isPending}
        title={isPending ? '创建中...' : '新增菜谱草稿'}
      >
        {isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
        <span>{isPending ? '创建中' : '新增'}</span>
      </button>
      {error && <p className="bs-control-error">{error}</p>}
    </div>
  )
}
