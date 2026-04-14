'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from './AuthProvider'

import { TemplateConfig } from '@/lib/templates'

interface SessionHeaderProps {
  session: {
    token: string
    title: string | null
    note: string | null
    budget: number | null
  }
  templateConfig?: TemplateConfig
}

export default function SessionHeader({ session, templateConfig }: SessionHeaderProps) {
  const { isAdmin } = useAuth()
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
      <div className="bg-white/45 border border-black/10 rounded-[18px] p-6 shadow-xl mb-6 animate-in fade-in slide-in-from-top-2 duration-200 ring-2 ring-primary/20">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5 ml-1">会话标题</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`例如：2024 ${templateConfig?.name || '新'}评价清单`}
                className="w-full px-4 py-2.5 bg-white/55 border border-black/10 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all font-medium"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5 ml-1">预算 (¥)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="无限制"
                className="w-full px-4 py-2.5 bg-white/55 border border-black/10 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all font-medium"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5 ml-1">备注说明</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="添加一些背景信息或评价标准..."
              rows={2}
              className="w-full px-4 py-2.5 bg-white/55 border border-black/10 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all resize-none font-medium"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-2.5 text-sm font-bold text-muted-foreground bg-muted hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors uppercase tracking-wider"
            >
              取消
            </button>
            <button
              disabled={loading}
              onClick={handleSave}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-slate-900 hover:opacity-90 rounded-xl transition-opacity shadow-lg shadow-black/5 disabled:bg-slate-300 disabled:opacity-50 uppercase tracking-wider"
            >
              {loading ? '保存中...' : '确认保存'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4 mb-8 group">
      <Link href="/wardrobe" className="text-muted-foreground hover:text-foreground mt-1.5 shrink-0 transition-all hover:-translate-x-1">
        <span className="text-2xl leading-none">←</span>
      </Link>
      <div
        className={`flex-1 min-w-0 p-3 -m-3 rounded-2xl transition-all ${isAdmin ? 'cursor-pointer hover:bg-card/80 border border-transparent hover:border-border/50 hover:shadow-sm' : ''}`}
        onClick={() => isAdmin && setIsEditing(true)}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-foreground truncate tracking-tight">
            {session.title || '未命名评价'}
          </h1>
          {isAdmin && <span className="text-[10px] uppercase tracking-widest text-primary/40 opacity-0 group-hover:opacity-100 transition-opacity font-black bg-primary/5 px-1.5 py-0.5 rounded">EDIT</span>}
        </div>
        {session.note ? (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 font-medium leading-relaxed">{session.note}</p>
        ) : (
          <p className="text-xs text-muted-foreground/30 mt-1.5 italic font-medium">点击添加备注和预算，更好地管理您的{templateConfig?.name || ''}评价。</p>
        )}
      </div>

    </div>
  )
}
