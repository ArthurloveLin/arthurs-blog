'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Session {
  id: string
  title: string | null
  note: string | null
  token: string
  budget: number | null
  archived: boolean
  created_at: string
  items: [{ count: number }]
}

interface SessionListProps {
  sessions: Session[]
  showArchived: boolean
}

export default function SessionList({ sessions, showArchived }: SessionListProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function handleArchive(session: Session) {
    setLoading(session.id)
    try {
      await fetch(`/api/sessions/${session.token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !session.archived }),
      })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(session: Session) {
    setLoading(session.id)
    setConfirmDelete(null)
    try {
      await fetch(`/api/sessions/${session.token}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  const visible = showArchived ? sessions : sessions.filter((s) => !s.archived)
  const archivedCount = sessions.filter((s) => s.archived).length

  return (
    <>
      {/* 归档切换提示 */}
      {archivedCount > 0 && (
        <div className="mb-3 text-center">
          <Link
            href={showArchived ? '/' : '/?archived=1'}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            {showArchived ? '隐藏已归档' : `查看 ${archivedCount} 个已归档会话`}
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {visible.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🛍️</div>
            <p>还没有选衣会话</p>
            <p className="text-sm mt-1">点击右上角「新建会话」开始</p>
          </div>
        )}

        {visible.map((session) => {
          const count = session.items?.[0]?.count ?? 0
          const date = new Date(session.created_at).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

          return (
            <div
              key={session.id}
              className={`relative bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow ${
                session.archived ? 'opacity-60' : ''
              }`}
            >
              {/* 确认删除遮罩 */}
              {confirmDelete === session.id && (
                <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl flex flex-col items-center justify-center gap-3 p-4">
                  <p className="text-sm text-gray-700 font-medium text-center">
                    确认删除「{session.title || '无标题会话'}」？<br />
                    <span className="text-xs text-gray-400 font-normal">图片和所有数据将永久删除</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-4 py-1.5 text-sm rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleDelete(session)}
                      className="px-4 py-1.5 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600"
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              )}

              <Link
                href={`/session/${session.token}`}
                className="block p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {session.archived && (
                        <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md shrink-0">归档</span>
                      )}
                      <h2 className="font-semibold text-gray-800 truncate">
                        {session.title || '无标题会话'}
                      </h2>
                    </div>
                    {session.note && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{session.note}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm text-gray-500">{count} 件</span>
                    {session.budget && (
                      <p className="text-xs text-gray-400">预算 ¥{session.budget}</p>
                    )}
                  </div>
                </div>
              </Link>

              {/* 操作按钮 */}
              <div className="flex border-t border-gray-50 divide-x divide-gray-50">
                <button
                  disabled={!!loading}
                  onClick={() => handleArchive(session)}
                  className="flex-1 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-bl-2xl transition-colors disabled:opacity-40"
                >
                  {loading === session.id ? '…' : session.archived ? '取消归档' : '归档'}
                </button>
                <button
                  disabled={!!loading}
                  onClick={() => setConfirmDelete(session.id)}
                  className="flex-1 py-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-br-2xl transition-colors disabled:opacity-40"
                >
                  删除
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
