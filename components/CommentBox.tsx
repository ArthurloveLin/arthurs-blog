'use client'

import { useEffect, useState, useRef, useMemo, createContext, use } from 'react'
import { updatePresenceActivity } from './ActivityBanner'
import { useAuth } from './AuthProvider'
import EditorActionBar from './EditorActionBar'
import { formatCommentTimeLabel } from '@/lib/date-format'

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  parent_id: string | null
}

interface CommentTreeContextValue {
  identityAliases: string[]
  isAdmin: boolean
  onReply: (comment: Comment) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => Promise<void>
}

const CommentTreeContext = createContext<CommentTreeContextValue | null>(null)

function useCommentTree() {
  const ctx = use(CommentTreeContext)
  if (!ctx) throw new Error('useCommentTree must be used within CommentTreeContext')
  return ctx
}

function canModifyComment(comment: Comment, identityAliases: string[], isAdmin: boolean) {
  return isAdmin || identityAliases.includes(comment.author)
}

function CommentCard({ comment }: { comment: Comment }) {
  const { identityAliases, isAdmin, onReply, onDelete, onUpdate } = useCommentTree()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editable = canModifyComment(comment, identityAliases, isAdmin)

  useEffect(() => {
    setDraft(comment.content)
  }, [comment.content])

  async function handleSave() {
    if (!draft.trim() || isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      await onUpdate(comment.id, draft.trim())
      setIsEditing(false)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '评论更新失败。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 bg-muted/30 border border-border/50 rounded-2xl px-3 py-2 hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-tight text-primary/80">{comment.author}</span>
          <span className="text-[10px] font-medium text-muted-foreground/50">{formatCommentTimeLabel(comment.created_at, comment.updated_at)}</span>
        </div>
        {isEditing ? (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/85">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[96px] w-full resize-y bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground outline-none transition"
            />
            <EditorActionBar
              leading={<span>评论编辑栏</span>}
              trailing={(
                <>
                  <button
                    type="button"
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 transition hover:text-foreground"
                    onClick={() => {
                      setDraft(comment.content)
                      setError(null)
                      setIsEditing(false)
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground transition disabled:opacity-40"
                    onClick={handleSave}
                    disabled={isSaving || !draft.trim()}
                  >
                    {isSaving ? '保存中' : '保存'}
                  </button>
                </>
              )}
            />
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-foreground/90 break-words leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        )}
        <div className="flex items-center justify-end gap-3">
          {editable && !isEditing ? (
            <button
              onClick={() => {
                setDraft(comment.content)
                setError(null)
                setIsEditing(true)
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-primary mt-1.5 transition-all"
            >
              编辑
            </button>
          ) : null}
          <button
            onClick={() => onReply(comment)}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-primary mt-1.5 transition-all"
          >
            回复
          </button>
        </div>
      </div>
      {canModifyComment(comment, identityAliases, isAdmin) && (
        <button
          onClick={() => onDelete(comment.id)}
          className="text-muted-foreground/20 hover:text-destructive text-xl leading-none mt-2 shrink-0 transition-colors px-1"
        >
          ×
        </button>
      )}
    </div>
  )
}

function ReplyCommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="ml-6">
      <CommentCard comment={comment} />
    </div>
  )
}

function TopLevelCommentItem({ comment, replies }: { comment: Comment; replies: Comment[] }) {
  return (
    <div>
      <CommentCard comment={comment} />
      {replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border/30 pl-1">
          {replies.map((reply) => (
            <ReplyCommentItem key={reply.id} comment={reply} />
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
  const { identity, identityAliases, isAdmin, publicIdentity } = useAuth()

  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    setError(null)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          author: publicIdentity,
          content: text.trim(),
          parent_id: replyTo?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error('评论发送失败。')
      const newComment: Comment = await res.json()
      setComments((prev) => [...prev, newComment])
      setText('')
      setReplyTo(null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '评论发送失败。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, identities: identityAliases }),
    })
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id))
      setError(null)
      return
    }

    setError(res.status === 403 ? '当前身份没有删除这条评论的权限。' : '删除评论失败。')
  }

  async function handleUpdate(id: string, content: string) {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, identities: identityAliases, content }),
    })

    if (!res.ok) {
      throw new Error(res.status === 403 ? '当前身份没有编辑这条评论的权限。' : '评论更新失败。')
    }

    const updatedComment: Comment = await res.json()
    setComments((prev) => prev.map((comment) => comment.id === id ? updatedComment : comment))
  }

  return (
    <CommentTreeContext value={{ identityAliases, isAdmin, onReply: handleReply, onDelete: handleDelete, onUpdate: handleUpdate }}>
      <div>
        <h3 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mb-4 px-1">
          评论 {comments.length > 0 && `(${comments.length})`}
        </h3>

        {topLevel.length > 0 && (
          <div className="space-y-4 mb-6">
            {topLevel.map((c) => (
              <TopLevelCommentItem
                key={c.id}
                comment={c}
                replies={repliesMap[c.id] ?? []}
              />
            ))}
          </div>
        )}

        {identity ? (
          <div className="space-y-3">
            <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-border bg-muted/20 transition-all focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20">
              <div className="flex-1 flex items-center">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => updatePresenceActivity('正在评论')}
                  placeholder={replyTo ? `回复 @${replyTo.author}…` : '写点什么…'}
                  rows={replyTo ? 3 : 2}
                  className="flex-1 resize-none px-4 py-3 text-sm leading-relaxed focus:outline-none bg-transparent placeholder:text-muted-foreground/30"
                />
              </div>
              <EditorActionBar
                leading={replyTo ? (
                  <>
                    <span>评论栏</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">回复 @{replyTo.author}</span>
                    <button type="button" className="text-muted-foreground/70 transition hover:text-foreground" onClick={() => setReplyTo(null)}>
                      取消回复
                    </button>
                  </>
                ) : <span>评论栏</span>}
                trailing={(
                  <button
                    type="submit"
                    disabled={submitting || !text.trim()}
                    className="rounded-full bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition-all hover:opacity-90 disabled:opacity-30"
                  >
                    {submitting ? '发送中' : '发送'}
                  </button>
                )}
              />
            </form>
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          </div>
        ) : (
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 text-center py-4 italic animate-pulse">加载身份中…</p>
        )}
      </div>
    </CommentTreeContext>
  )
}
