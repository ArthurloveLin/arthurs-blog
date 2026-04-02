'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import data from '@emoji-mart/data'
import { updatePresenceActivity } from './ActivityBanner'

// emoji-mart uses browser APIs, must be client-only
const Picker = dynamic(() => import('@emoji-mart/react'), { ssr: false })

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
  parent_id: string | null
}

interface CommentBoxProps {
  itemId: string
  author: string
  initialComments: Comment[]
}

export default function CommentBox({ itemId, author, initialComments }: CommentBoxProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    function onClickOutside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showEmoji])

  // Build tree: top-level + replies map
  const topLevel = comments.filter((c) => !c.parent_id)
  const repliesMap = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.parent_id) acc[c.parent_id] = [...(acc[c.parent_id] ?? []), c]
    return acc
  }, {})

  function handleReply(comment: Comment) {
    setReplyTo({ id: comment.id, author: comment.author })
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  function insertEmoji(emoji: { native: string }) {
    setText((prev) => prev + emoji.native)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !author || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          author,
          content: text.trim(),
          parent_id: replyTo?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const newComment: Comment = await res.json()
      setComments((prev) => [...prev, newComment])
      setText('')
      setReplyTo(null)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id))
    }
  }

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  function CommentItem({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) {
    const replies = repliesMap[comment.id] ?? []
    return (
      <div className={isReply ? 'ml-6' : ''}>
        <div className="flex gap-2 items-start">
          <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium text-pink-500">{comment.author}</span>
              <span className="text-xs text-gray-400">{formatTime(comment.created_at)}</span>
            </div>
            <p className="text-sm text-gray-700 break-words">{comment.content}</p>
            <button
              onClick={() => handleReply(comment)}
              className="text-xs text-gray-400 hover:text-pink-400 mt-1 transition-colors"
            >
              回复
            </button>
          </div>
          {comment.author === author && (
            <button
              onClick={() => handleDelete(comment.id)}
              className="text-gray-300 hover:text-red-400 text-lg leading-none mt-2 shrink-0"
            >
              ×
            </button>
          )}
        </div>
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((r) => (
              <CommentItem key={r.id} comment={r} isReply />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        评论 {comments.length > 0 && `(${comments.length})`}
      </h3>

      {topLevel.length > 0 && (
        <div className="space-y-3 mb-4">
          {topLevel.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </div>
      )}

      {author ? (
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-pink-50 px-3 py-1.5 rounded-lg">
              <span>回复 <span className="font-medium text-pink-500">@{replyTo.author}</span></span>
              <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600">取消</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            {/* Input row — no overflow-hidden so picker can escape */}
            <div className="flex-1 flex items-center border border-gray-200 rounded-xl focus-within:border-pink-300 bg-white">
              {/* Emoji trigger — sits outside form's overflow context */}
              <div ref={emojiRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  className="px-2.5 py-2 text-base leading-none text-gray-400 hover:text-yellow-500 transition-colors"
                >
                  😊
                </button>
                {showEmoji && (
                  <div className="absolute bottom-full left-0 mb-2 z-50">
                    <Picker
                      data={data}
                      onEmojiSelect={insertEmoji}
                      locale="zh"
                      previewPosition="none"
                      skinTonePosition="none"
                      theme="light"
                    />
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => updatePresenceActivity('正在评论')}
                placeholder={replyTo ? `回复 @${replyTo.author}…` : '写点什么…'}
                className="flex-1 py-2 pr-3 text-sm focus:outline-none bg-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-4 py-2 bg-pink-500 text-white text-sm rounded-xl disabled:opacity-50 hover:bg-pink-600 transition-colors shrink-0"
            >
              发送
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">请先选择身份再评论</p>
      )}
    </div>
  )
}
