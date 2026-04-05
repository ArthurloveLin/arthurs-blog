'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { logout } from '@/app/auth/logout/actions'

interface SessionHeaderProps {
  session: {
    token: string
    title: string | null
    note: string | null
    budget: number | null
  }
  isAdmin?: boolean
}

export default function SessionHeader({ session, isAdmin = false }: SessionHeaderProps) {
  const { role, displayName, email } = useAuth()
  const isLoggedIn = role !== 'guest'
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(session.title || '')
  const [note, setNote] = useState(session.note || '')
  const [budget, setBudget] = useState(session.budget?.toString() || '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          note, 
          budget: budget === '' ? null : parseInt(budget, 10) 
        }),
      })
      if (res.ok) {
        setIsEditing(false)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (isEditing) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground/60 mb-1">会话标题</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：2024 春季购物清单"
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/30 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-medium text-muted-foreground/60 mb-1">预算 (¥)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="无限制"
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/30 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground/60 mb-1">备注说明</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="添加一些备注..."
              rows={2}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/30 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-1.5 text-sm font-medium text-muted-foreground bg-muted hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              disabled={loading}
              onClick={handleSave}
              className="flex-1 py-1.5 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-xl transition-opacity shadow-sm disabled:opacity-50"
            >
              {loading ? '保存中...' : '确认保存'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 mb-6 group">
      <Link href="/wardrobe" className="text-muted-foreground hover:text-foreground mt-1.5 shrink-0 transition-colors">
        <span className="text-xl leading-none">←</span>
      </Link>
      <div
        className={`flex-1 min-w-0 p-2 -m-2 rounded-xl transition-colors ${isAdmin ? 'cursor-pointer hover:bg-card/80 border border-transparent hover:border-border/50' : ''}`}
        onClick={() => isAdmin && setIsEditing(true)}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground truncate">
            {session.title || '未命名会话'}
          </h1>
          {isAdmin && <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity font-bold">编辑</span>}
        </div>
        {session.note ? (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{session.note}</p>
        ) : (
          <p className="text-xs text-muted-foreground/30 mt-0.5 italic">点击添加备注和预算...</p>
        )}
      </div>
      {isLoggedIn && (
        <form action={logout} className="shrink-0 mt-1">
          <button
            type="submit"
            title={`${displayName || email} — 退出登录`}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
          >
            退出
          </button>
        </form>
      )}
    </div>
  )
}
