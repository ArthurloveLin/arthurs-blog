'use client'

import { useState, useRef, useMemo } from 'react'
import { updatePresenceActivity } from './ActivityBanner'
import { useAuth } from './AuthProvider'
import { formatCommentTimestamp } from '@/lib/date-format'

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
  parent_id: string | null
}

function CommentItem({
  comment,
  isReply = false,
  repliesMap,
  onReply,
  onDelete,
  identity,
}: {
  comment: Comment
  isReply?: boolean
  repliesMap: Record<string, Comment[]>
  onReply: (comment: Comment) => void
  onDelete: (id: string) => void
  identity: string
}) {
  const replies = repliesMap[comment.id] ?? []
  return (
    <div className={isReply ? 'ml-6' : ''}>
      <div className="flex gap-2 items-start">
        <div className="flex-1 bg-muted/30 border border-border/50 rounded-2xl px-3 py-2 hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-tight text-primary/80">{comment.author}</span>
            <span className="text-[10px] font-medium text-muted-foreground/50">{formatCommentTimestamp(comment.created_at)}</span>
          </div>
          <p className="text-sm text-foreground/90 break-words leading-relaxed">{comment.content}</p>
          <div className="flex items-center justify-end">
            <button
              onClick={() => onReply(comment)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-primary mt-1.5 transition-all"
            >
              回复
            </button>
          </div>
        </div>
        {comment.author === identity && (
          <button
            onClick={() => onDelete(comment.id)}
            className="text-muted-foreground/20 hover:text-destructive text-xl leading-none mt-2 shrink-0 transition-colors px-1"
          >
            ×
          </button>
        )}
      </div>
      {replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border/30 pl-1">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              isReply={false} // Already handled by ml-6 and parent
              repliesMap={repliesMap}
              onReply={onReply}
              onDelete={onDelete}
              identity={identity}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CommentBoxProps {
  targetType: 'wardrobe_item' | 'blog_post'
  targetId: string
  initialComments: Comment[]
}

export default function CommentBox({ targetType, targetId, initialComments }: CommentBoxProps) {
  const { displayName, email, guestId } = useAuth()
  const identity = displayName || email || guestId

  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Build tree: top-level + replies map
  const topLevel = useMemo(() => comments.filter((c) => !c.parent_id), [comments])
  const repliesMap = useMemo(() => comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.parent_id) acc[c.parent_id] = [...(acc[c.parent_id] ?? []), c]
    return acc
  }, {}), [comments])

  function handleReply(comment: Comment) {
    setReplyTo({ id: comment.id, author: comment.author })
    inputRef.current?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !identity || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          author: identity,
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
    const res = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity }),
    })
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id))
    }
  }

  return (
    <div>
      <h3 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mb-4 px-1">
        评论 {comments.length > 0 && `(${comments.length})`}
      </h3>

      {topLevel.length > 0 && (
        <div className="space-y-4 mb-6">
          {topLevel.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              repliesMap={repliesMap}
              onReply={handleReply}
              onDelete={handleDelete}
              identity={identity}
            />
          ))}
        </div>
      )}

      {identity ? (
        <div className="space-y-3">
          {replyTo && (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/5 px-3 py-2 rounded-xl border border-primary/10">
              <span className="opacity-60">回复</span>
              <span className="bg-primary/20 px-1.5 py-0.5 rounded">@{replyTo.author}</span>
              <button onClick={() => setReplyTo(null)} className="ml-auto text-muted-foreground/40 hover:text-foreground">取消</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 flex items-center border border-border rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 bg-muted/20 transition-all">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => updatePresenceActivity('正在评论')}
                placeholder={replyTo ? `回复 @${replyTo.author}…` : '写点什么…'}
                className="flex-1 px-4 py-2 text-sm focus:outline-none bg-transparent placeholder:text-muted-foreground/30"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-2xl disabled:opacity-30 hover:opacity-90 transition-all active:scale-95 shadow-sm"
            >
              发送
            </button>
          </form>
        </div>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 text-center py-4 italic animate-pulse">加载身份中…</p>
      )}
    </div>
  )
}
