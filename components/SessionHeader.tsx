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
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">会话标题</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：2024 春季购物清单"
                className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-gray-800 placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">预算 (¥)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="无限制"
                className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-gray-800 placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">备注说明</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="添加一些备注..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-gray-800 placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              disabled={loading}
              onClick={handleSave}
              className="flex-1 py-2 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
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
      <Link href="/wardrobe" className="text-gray-400 hover:text-gray-600 mt-1 shrink-0">
        <span className="text-xl leading-none">←</span>
      </Link>
      <div
        className={`flex-1 min-w-0 p-2 -m-2 rounded-xl transition-colors ${isAdmin ? 'cursor-pointer hover:bg-white/50' : ''}`}
        onClick={() => isAdmin && setIsEditing(true)}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800 truncate">
            {session.title || '未命名会话'}
          </h1>
          {isAdmin && <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">编辑</span>}
        </div>
        {session.note ? (
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{session.note}</p>
        ) : (
          <p className="text-xs text-gray-300 mt-0.5 italic">点击添加备注和预算...</p>
        )}
      </div>
      {isLoggedIn && (
        <form action={logout} className="shrink-0 mt-1">
          <button
            type="submit"
            title={`${displayName || email} — 退出登录`}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            退出
          </button>
        </form>
      )}
    </div>
  )
}
