'use client'

import { useState } from 'react'

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
}

interface CommentBoxProps {
  itemId: string
  author: string
  initialComments: Comment[]
}

export default function CommentBox({ itemId, author, initialComments }: CommentBoxProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !author || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, author, content: text.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      const newComment: Comment = await res.json()
      setComments((prev) => [...prev, newComment])
      setText('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        评论 {comments.length > 0 && `(${comments.length})`}
      </h3>

      {comments.length > 0 && (
        <div className="space-y-2 mb-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 items-start">
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-pink-500">{c.author}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(c.created_at).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{c.content}</p>
              </div>
              {c.author === author && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none mt-2"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {author ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="写点什么..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="px-4 py-2 bg-pink-500 text-white text-sm rounded-xl disabled:opacity-50 hover:bg-pink-600 transition-colors"
          >
            发送
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">请先选择身份再评论</p>
      )}
    </div>
  )
}
