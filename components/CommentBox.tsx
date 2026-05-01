'use client'

import { createContext, use, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Clock3, MessageCircleReply, PencilLine, Trash2, X } from 'lucide-react'
import { updatePresenceActivity } from './ActivityBanner'
import { useAuth } from './AuthProvider'
import EmojiPickerButton from './emoji/EmojiPickerButton'
import EmojiReactionSummary from './emoji/EmojiReactionSummary'
import EditorActionBar from './EditorActionBar'
import ReactionToggleBar from './ReactionToggleBar'
import type { EmojiReactionEntry } from '@/lib/comment-emojis'
import { formatCommentTimeLabel } from '@/lib/date-format'
import { COMMENT_MAX_LENGTH } from '@/lib/input-limits'
import type { ReactionValue } from '@/lib/comment-reactions'
import { insertTextAtSelection } from '@/lib/text-selection'

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  parent_id: string | null
  upvotes: number
  downvotes: number
  viewer_reaction: ReactionValue
  emoji_reactions: EmojiReactionEntry[]
  viewer_emojis: string[]
  optimistic?: boolean
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
  reactingIds: Record<string, boolean>
  emojiReactingIds: Record<string, boolean>
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onDraftChange: (value: string) => void
  onReply: (comment: Comment) => void
  onCancelReply: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => Promise<void>
  onReact: (id: string, reaction: 1 | -1) => Promise<void>
  onEmojiReact: (id: string, emoji: string) => Promise<void>
}

const CommentTreeContext = createContext<CommentTreeContextValue | null>(null)

function limitCommentText(value: string) {
  return value.slice(0, COMMENT_MAX_LENGTH)
}

function getLengthTone(length: number, maxLength: number) {
  return maxLength - length <= Math.min(40, Math.floor(maxLength * 0.12)) ? 'text-amber-600' : 'text-muted-foreground/75'
}

function useCommentTree() {
  const ctx = use(CommentTreeContext)
  if (!ctx) throw new Error('useCommentTree must be used within CommentTreeContext')
  return ctx
}

function canModifyComment(comment: Comment, identityAliases: string[], isAdmin: boolean) {
  return isAdmin || identityAliases.includes(comment.author)
}

function applyOptimisticReactionToComment(comment: Comment, nextReaction: 1 | -1 | 0): Comment {
  let upvotes = comment.upvotes
  let downvotes = comment.downvotes

  if (comment.viewer_reaction === 1) {
    upvotes = Math.max(0, upvotes - 1)
  } else if (comment.viewer_reaction === -1) {
    downvotes = Math.max(0, downvotes - 1)
  }

  if (nextReaction === 1) {
    upvotes += 1
  } else if (nextReaction === -1) {
    downvotes += 1
  }

  return {
    ...comment,
    upvotes,
    downvotes,
    viewer_reaction: nextReaction,
  }
}

function applyOptimisticEmojiToComment(comment: Comment, nextEmoji: string): Comment {
  const viewerEmojiSet = new Set(comment.viewer_emojis)
  const removingEmoji = viewerEmojiSet.has(nextEmoji)
  const summaryMap = new Map(comment.emoji_reactions.map((entry) => [entry.emoji, { ...entry }]))

  if (removingEmoji) {
    viewerEmojiSet.delete(nextEmoji)
    const previous = summaryMap.get(nextEmoji)
    if (previous) {
      const nextCount = previous.count - 1
      if (nextCount > 0) {
        summaryMap.set(nextEmoji, { ...previous, count: nextCount, viewer: false })
      } else {
        summaryMap.delete(nextEmoji)
      }
    }
  } else {
    viewerEmojiSet.add(nextEmoji)
    const current = summaryMap.get(nextEmoji)
    summaryMap.set(nextEmoji, {
      emoji: nextEmoji,
      count: (current?.count ?? 0) + 1,
      viewer: true,
    })
  }

  return {
    ...comment,
    viewer_emojis: [...viewerEmojiSet].sort((left, right) => left.localeCompare(right)),
    emoji_reactions: [...summaryMap.values()].sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      if (left.viewer !== right.viewer) {
        return Number(right.viewer) - Number(left.viewer)
      }

      return left.emoji.localeCompare(right.emoji)
    }),
  }
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(limitCommentText(`${value}${emoji}`))
      return
    }

    const result = insertTextAtSelection(value, emoji, textarea.selectionStart, textarea.selectionEnd)
    onChange(limitCommentText(result.value))

    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  return (
    <CommentComposerShell
      actionBar={(
        <EditorActionBar
          leading={(
            <>
              <span>评论编辑栏</span>
              <EmojiPickerButton size="sm" panelAlign="start" onSelect={insertEmoji} />
            </>
          )}
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
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(limitCommentText(event.target.value))}
        maxLength={COMMENT_MAX_LENGTH}
        className="min-h-[96px] w-full resize-y bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground outline-none transition focus:ring-0 focus:shadow-none"
      />
      <div className="flex items-center justify-between px-3 pb-3 text-[11px]">
        <span className="text-muted-foreground/70">最多 {COMMENT_MAX_LENGTH} 字</span>
        <span className={getLengthTone(value.length, COMMENT_MAX_LENGTH)}>
          已输入 {value.length} 字，还剩 {Math.max(COMMENT_MAX_LENGTH - value.length, 0)} 字
        </span>
      </div>
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

function CommentIconButton({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  children: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/65 text-slate-500 transition-all duration-200 hover:-translate-y-px hover:bg-white',
        tone === 'danger' ? 'hover:border-rose-200 hover:text-rose-600' : 'hover:border-slate-300 hover:text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function CommentCard({ comment }: { comment: Comment }) {
  const { identityAliases, isAdmin, reactingIds, emojiReactingIds, onReply, onDelete, onUpdate, onReact, onEmojiReact } = useCommentTree()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    <div className={['flex gap-2 items-start', comment.optimistic ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''].filter(Boolean).join(' ')}>
      <div className="flex-1 rounded-[18px] border border-black/5 bg-white/35 px-3.5 py-3 shadow-[0_4px_12px_-6px_rgba(0,0,0,0.06)] transition-all hover:bg-white/50">
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className="pt-1 text-[10px] font-bold uppercase tracking-tight text-slate-800">{comment.author}</span>
          <div className="flex min-h-8 items-center justify-end gap-1.5">
            {editable && !isEditing ? (
              confirmDelete ? (
                <>
                  <CommentIconButton label="取消删除" onClick={() => setConfirmDelete(false)}>
                    <X size={14} strokeWidth={1.9} />
                  </CommentIconButton>
                  <CommentIconButton label="确认删除" onClick={() => {
                    setConfirmDelete(false)
                    onDelete(comment.id)
                  }} tone="danger">
                    <Check size={14} strokeWidth={2.1} />
                  </CommentIconButton>
                </>
              ) : (
                <CommentIconButton label="删除评论" onClick={() => setConfirmDelete(true)} tone="danger">
                  <Trash2 size={14} strokeWidth={1.9} />
                </CommentIconButton>
              )
            ) : null}
          </div>
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
          <div className="w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
            {comment.content.split('\n').map((line, index) => (
              <p key={`${comment.id}-l-${index}`}>
                {line.length > 0 ? renderInlineFormattedText(line, `${comment.id}-${index}`) : <span>&nbsp;</span>}
              </p>
            ))}
          </div>
        )}
        {!isEditing ? (
          <EmojiReactionSummary
            entries={comment.emoji_reactions}
            onSelect={(emoji) => void onEmojiReact(comment.id, emoji)}
            className="mt-3"
          />
        ) : null}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
            <Clock3 size={12} strokeWidth={1.9} />
            <span>{comment.optimistic ? '发送中…' : formatCommentTimeLabel(comment.created_at, comment.updated_at)}</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <ReactionToggleBar
              compact
              upvotes={comment.upvotes}
              downvotes={comment.downvotes}
              viewerReaction={comment.viewer_reaction}
              pending={Boolean(reactingIds[comment.id])}
              emojiPending={Boolean(emojiReactingIds[comment.id])}
              onReact={(reaction) => void onReact(comment.id, reaction)}
              onEmojiReact={(emoji) => void onEmojiReact(comment.id, emoji)}
            />
            <CommentIconButton label="回复评论" onClick={() => onReply(comment)}>
              <MessageCircleReply size={14} strokeWidth={1.9} />
            </CommentIconButton>
            {editable && !isEditing ? (
              <CommentIconButton label="编辑评论" onClick={() => {
                setDraft(comment.content)
                setError(null)
                setConfirmDelete(false)
                setIsEditing(true)
              }}>
                <PencilLine size={14} strokeWidth={1.9} />
              </CommentIconButton>
            ) : null}
          </div>
        </div>
      </div>
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

  function insertEmoji(emoji: string) {
    const textarea = composerRef.current
    if (!textarea) {
      onDraftChange(limitCommentText(`${draft}${emoji}`))
      return
    }

    const result = insertTextAtSelection(draft, emoji, textarea.selectionStart, textarea.selectionEnd)
    onDraftChange(limitCommentText(result.value))

    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

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
                <EmojiPickerButton size="sm" panelAlign="start" onSelect={insertEmoji} />
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">回复 @{replyTo.author}</span>
                <button type="button" className="text-muted-foreground/70 transition hover:text-foreground" onClick={onCancelReply}>
                  取消回复
                </button>
              </>
            ) : (
              <>
                <span>评论栏</span>
                <EmojiPickerButton size="sm" panelAlign="start" onSelect={insertEmoji} />
              </>
            )}
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
            onChange={(event) => onDraftChange(limitCommentText(event.target.value))}
            onFocus={() => updatePresenceActivity('正在评论')}
            placeholder={replyTo ? `回复 @${replyTo.author}…` : '写点什么…'}
            rows={replyTo ? 3 : 2}
            maxLength={COMMENT_MAX_LENGTH}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0 focus:shadow-none"
          />
        </div>
      </CommentComposerShell>
      <div className="flex items-center justify-between px-1 text-[11px]">
        <span className="text-muted-foreground/70">最多 {COMMENT_MAX_LENGTH} 字</span>
        <span className={getLengthTone(draft.length, COMMENT_MAX_LENGTH)}>
          已输入 {draft.length} 字，还剩 {Math.max(COMMENT_MAX_LENGTH - draft.length, 0)} 字
        </span>
      </div>
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
  const [reactingIds, setReactingIds] = useState<Record<string, boolean>>({})
  const [emojiReactingIds, setEmojiReactingIds] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const commentsRef = useRef(initialComments)
  const freshTimerRefs = useRef<Record<string, number>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    commentsRef.current = comments
  }, [comments])

  useEffect(() => {
    if (!mounted || !identity) return

    const controller = new AbortController()
    const searchParams = new URLSearchParams({ target_type: targetType, target_id: targetId, identity })

    void fetch(`/api/comments?${searchParams.toString()}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Comment[]> : null)
      .then((nextComments) => {
        if (!nextComments) return

        setComments((current) => {
          const optimisticComments = current.filter((comment) => comment.optimistic)
          return [...nextComments, ...optimisticComments.filter((comment) => !nextComments.some((entry) => entry.id === comment.id))]
        })
      })
      .catch((fetchError) => {
        if ((fetchError as Error).name !== 'AbortError') {
          setError((current) => current ?? '评论状态同步失败。')
        }
      })

    return () => controller.abort()
  }, [identity, mounted, targetId, targetType])

  useEffect(() => () => {
    Object.values(freshTimerRefs.current).forEach((timer) => window.clearTimeout(timer))
  }, [])

  function markCommentFresh(id: string) {
    const timer = window.setTimeout(() => {
      setComments((current) => current.map((comment) => comment.id === id ? { ...comment, optimistic: false } : comment))
      delete freshTimerRefs.current[id]
    }, 900)

    freshTimerRefs.current[id] = timer
  }

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

    const draftValue = draft.trim()
    const replyTarget = replyTo
    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticComment: Comment = {
      id: optimisticId,
      author: publicIdentity,
      content: draftValue,
      created_at: new Date().toISOString(),
      updated_at: null,
      parent_id: replyTarget?.id ?? null,
      upvotes: 0,
      downvotes: 0,
      viewer_reaction: 0,
      emoji_reactions: [],
      viewer_emojis: [],
      optimistic: true,
    }

    setSubmitting(true)
    setError(null)
    setComments((prev) => [...prev, optimisticComment])
    setDraft('')
    setReplyTo(null)
    markCommentFresh(optimisticId)

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          author: publicIdentity,
          content: draftValue,
          parent_id: replyTarget?.id ?? null,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error === 'Content too long' ? `评论不能超过 ${COMMENT_MAX_LENGTH} 字。` : '评论发送失败。')
      }
      const newComment: Comment = await res.json()
      setComments((prev) => prev.map((comment) => comment.id === optimisticId ? newComment : comment))
      markCommentFresh(newComment.id)
    } catch (submitError) {
      setComments((prev) => prev.filter((comment) => comment.id !== optimisticId))
      setDraft(draftValue)
      setReplyTo(replyTarget)
      setError(submitError instanceof Error ? submitError.message : '评论发送失败。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const snapshot = commentsRef.current
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

    setComments(snapshot)
    setError(res.status === 403 ? '当前身份没有删除这条评论的权限。' : '删除评论失败。')
  }

  async function handleUpdate(id: string, content: string) {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, identities: identityAliases, content }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null
      if (res.status === 403) {
        throw new Error('当前身份没有编辑这条评论的权限。')
      }
      throw new Error(payload?.error === 'Content too long' ? `评论不能超过 ${COMMENT_MAX_LENGTH} 字。` : '评论更新失败。')
    }

    const updatedComment: Comment = await res.json()
    setComments((prev) => prev.map((comment) => comment.id === id
      ? {
        ...updatedComment,
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
        viewer_reaction: comment.viewer_reaction,
        emoji_reactions: comment.emoji_reactions,
        viewer_emojis: comment.viewer_emojis,
      }
      : comment))
  }

  async function handleReaction(id: string, reaction: 1 | -1) {
    if (!identity || reactingIds[id]) return

    const snapshot = commentsRef.current.find((comment) => comment.id === id)
    if (!snapshot) return

    const nextReaction = snapshot.viewer_reaction === reaction ? 0 : reaction

    setReactingIds((current) => ({ ...current, [id]: true }))
    setComments((prev) => prev.map((comment) => comment.id === id ? applyOptimisticReactionToComment(comment, nextReaction) : comment))

    try {
      const res = await fetch(`/api/comments/${id}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, reaction: nextReaction }),
      })

      if (!res.ok) {
        throw new Error('互动更新失败。')
      }

      const summary = await res.json() as Pick<Comment, 'upvotes' | 'downvotes' | 'viewer_reaction'>
      setComments((prev) => prev.map((comment) => comment.id === id ? { ...comment, ...summary } : comment))
    } catch (reactionError) {
      setComments((prev) => prev.map((comment) => comment.id === id ? snapshot : comment))
      setError(reactionError instanceof Error ? reactionError.message : '互动更新失败。')
    } finally {
      setReactingIds((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    }
  }

  async function handleEmojiReaction(id: string, emoji: string) {
    if (!identity || emojiReactingIds[id]) return

    const snapshot = commentsRef.current.find((comment) => comment.id === id)
    if (!snapshot) return

    setEmojiReactingIds((current) => ({ ...current, [id]: true }))
    setComments((prev) => prev.map((comment) => comment.id === id ? applyOptimisticEmojiToComment(comment, emoji) : comment))

    try {
      const res = await fetch(`/api/comments/${id}/emoji`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, emoji }),
      })

      if (!res.ok) {
        throw new Error('表情互动更新失败。')
      }

      const summary = await res.json() as Pick<Comment, 'emoji_reactions' | 'viewer_emojis'>
      setComments((prev) => prev.map((comment) => comment.id === id ? { ...comment, ...summary } : comment))
    } catch (emojiError) {
      setComments((prev) => prev.map((comment) => comment.id === id ? snapshot : comment))
      setError(emojiError instanceof Error ? emojiError.message : '表情互动更新失败。')
    } finally {
      setEmojiReactingIds((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    }
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
    reactingIds,
    emojiReactingIds,
    composerRef: inputRef,
    onDraftChange: (value) => setDraft(limitCommentText(value)),
    onReply: handleReply,
    onCancelReply: () => setReplyTo(null),
    onSubmit: handleSubmit,
    onDelete: handleDelete,
    onUpdate: handleUpdate,
    onReact: handleReaction,
    onEmojiReact: handleEmojiReaction,
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
