'use client'

import { createContext, use, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
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
  comments: Comment[]
  topLevelComments: Comment[]
  repliesByParentId: Record<string, Comment[]>
  replyTo: { id: string; author: string } | null
  draft: string
  submitting: boolean
  error: string | null
  identityReady: boolean
  identityAliases: string[]
  isAdmin: boolean
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onDraftChange: (value: string) => void
  onReply: (comment: Comment) => void
  onCancelReply: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
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

function renderInlineFormattedText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|==[^=\n]+==)/g
  let cursor = 0
  let match = pattern.exec(text)
  let index = 0

  while (match) {
    const [token] = match
    const tokenStart = match.index

    if (tokenStart > cursor) {
      nodes.push(text.slice(cursor, tokenStart))
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-em-${index}`} className="italic">{token.slice(1, -1)}</em>)
    } else if (token.startsWith('==') && token.endsWith('==')) {
      nodes.push(<mark key={`${keyPrefix}-mark-${index}`} className="rounded-[0.35em] bg-amber-200/85 px-1 py-[0.05em] text-slate-900">{token.slice(2, -2)}</mark>)
    }

    cursor = tokenStart + token.length
    index += 1
    match = pattern.exec(text)
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes.length > 0 ? nodes : [text]
}

function CommentComposerShell({
  children,
  actionBar,
  onSubmit,
}: {
  children: ReactNode
  actionBar: ReactNode
  onSubmit?: (event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
  const className = 'overflow-hidden rounded-[18px] border border-black/10 bg-white/45 transition-all focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20'

  if (onSubmit) {
    return (
      <form onSubmit={onSubmit} className={className}>
        {children}
        {actionBar}
      </form>
    )
  }

  return (
    <div className={className}>
      {children}
      {actionBar}
    </div>
  )
}

function CommentEditorForm({
  value,
  onChange,
  onCancel,
  onSave,
  isSaving,
  error,
}: {
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
  isSaving: boolean
  error: string | null
}) {
  return (
    <CommentComposerShell
      actionBar={(
        <EditorActionBar
          leading={<span>评论编辑栏</span>}
          trailing={(
            <>
              <button
                type="button"
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 transition hover:text-foreground"
                onClick={onCancel}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white transition hover:opacity-90 disabled:bg-slate-300"
                onClick={onSave}
                disabled={isSaving || !value.trim()}
              >
                {isSaving ? '保存中' : '保存'}
              </button>
            </>
          )}
        />
      )}
    >
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[96px] w-full resize-y bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground outline-none transition focus:ring-0 focus:shadow-none"
      />
      {error ? <p className="px-3 pb-3 text-xs text-rose-600">{error}</p> : null}
    </CommentComposerShell>
  )
}

function CommentThreadHeader() {
  const { comments } = useCommentTree()

  return (
    <h3 className="mb-4 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
      评论 {comments.length > 0 && `(${comments.length})`}
    </h3>
  )
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
      <div className="flex-1 bg-white/35 border border-black/5 rounded-[18px] px-3.5 py-3 hover:bg-white/50 transition-all shadow-[0_4px_12px_-6px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-tight text-slate-800">{comment.author}</span>
          <span className="text-[10px] font-medium text-slate-400">{formatCommentTimeLabel(comment.created_at, comment.updated_at)}</span>
        </div>
        {isEditing ? (
          <CommentEditorForm
            value={draft}
            onChange={setDraft}
            onCancel={() => {
              setDraft(comment.content)
              setError(null)
              setIsEditing(false)
            }}
            onSave={handleSave}
            isSaving={isSaving}
            error={error}
          />
        ) : (
          <div className="text-sm text-slate-800 w-full whitespace-pre-wrap break-words leading-relaxed">
            {comment.content.split('\n').map((line, index) => (
              <p key={`${comment.id}-l-${index}`}>
                {line.length > 0 ? renderInlineFormattedText(line, `${comment.id}-${index}`) : <span>&nbsp;</span>}
              </p>
            ))}
          </div>
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
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 mt-2 transition-all"
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

function CommentReplyList({ parentId }: { parentId: string }) {
  const { repliesByParentId } = useCommentTree()
  const replies = repliesByParentId[parentId] ?? []

  if (replies.length === 0) {
    return null
  }

  return (
    <div className="mt-2 space-y-2 border-l border-border/30 pl-1">
      {replies.map((reply) => (
        <div key={reply.id} className="ml-6">
          <CommentCard comment={reply} />
        </div>
      ))}
    </div>
  )
}

function CommentThreadItem({ comment }: { comment: Comment }) {
  return (
    <div>
      <CommentCard comment={comment} />
      <CommentReplyList parentId={comment.id} />
    </div>
  )
}

function CommentThreadList() {
  const { topLevelComments } = useCommentTree()

  if (topLevelComments.length === 0) {
    return null
  }

  return (
    <div className="mb-6 space-y-4">
      {topLevelComments.map((comment) => (
        <CommentThreadItem key={comment.id} comment={comment} />
      ))}
    </div>
  )
}

function CommentThreadComposer() {
  const {
    draft,
    error,
    identityReady,
    replyTo,
    submitting,
    composerRef,
    onCancelReply,
    onDraftChange,
    onSubmit,
  } = useCommentTree()

  if (!identityReady) {
    return <p className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 italic animate-pulse">加载身份中…</p>
  }

  return (
    <div className="space-y-3">
      <CommentComposerShell
        onSubmit={onSubmit}
        actionBar={(
          <EditorActionBar
            leading={replyTo ? (
              <>
                <span>评论栏</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">回复 @{replyTo.author}</span>
                <button type="button" className="text-muted-foreground/70 transition hover:text-foreground" onClick={onCancelReply}>
                  取消回复
                </button>
              </>
            ) : <span>评论栏</span>}
            trailing={(
              <button
                type="submit"
                disabled={submitting || !draft.trim()}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:opacity-90 disabled:opacity-30 disabled:bg-slate-400"
              >
                {submitting ? '发送中' : '发送'}
              </button>
            )}
          />
        )}
      >
        <div className="flex flex-1 items-center">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onFocus={() => updatePresenceActivity('正在评论')}
            placeholder={replyTo ? `回复 @${replyTo.author}…` : '写点什么…'}
            rows={replyTo ? 3 : 2}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0 focus:shadow-none"
          />
        </div>
      </CommentComposerShell>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}

function CommentThreadRoot({ children, value }: { children: ReactNode; value: CommentTreeContextValue }) {
  return <CommentTreeContext value={value}>{children}</CommentTreeContext>
}

const CommentThread = {
  Root: CommentThreadRoot,
  Header: CommentThreadHeader,
  List: CommentThreadList,
  Composer: CommentThreadComposer,
}

interface CommentBoxProps {
  targetType: 'wardrobe_item' | 'blog_post'
  targetId: string
  initialComments: Comment[]
}

export default function CommentBox({ targetType, targetId, initialComments }: CommentBoxProps) {
  const { identity, identityAliases, isAdmin, publicIdentity } = useAuth()

  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const topLevelComments = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments])
  const repliesByParentId = useMemo(() => comments.reduce<Record<string, Comment[]>>((accumulator, comment) => {
    if (comment.parent_id) {
      accumulator[comment.parent_id] = [...(accumulator[comment.parent_id] ?? []), comment]
    }

    return accumulator
  }, {}), [comments])

  function handleReply(comment: Comment) {
    setReplyTo({ id: comment.id, author: comment.author })
    inputRef.current?.focus()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.trim() || !identity || submitting) return

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
          content: draft.trim(),
          parent_id: replyTo?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error('评论发送失败。')
      const newComment: Comment = await res.json()
      setComments((prev) => [...prev, newComment])
      setDraft('')
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

  const contextValue: CommentTreeContextValue = {
    comments,
    topLevelComments,
    repliesByParentId,
    replyTo,
    draft,
    submitting,
    error,
    identityReady: mounted && Boolean(identity),
    identityAliases,
    isAdmin,
    composerRef: inputRef,
    onDraftChange: setDraft,
    onReply: handleReply,
    onCancelReply: () => setReplyTo(null),
    onSubmit: handleSubmit,
    onDelete: handleDelete,
    onUpdate: handleUpdate,
  }

  return (
    <CommentThread.Root value={contextValue}>
      <div>
        <CommentThread.Header />
        <CommentThread.List />
        <CommentThread.Composer />
      </div>
    </CommentThread.Root>
  )
}
