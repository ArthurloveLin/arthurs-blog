'use client'

import { useEffect, useState } from 'react'
import CommentBox from '@/components/CommentBox'
import { formatCommentTimeLabel } from '@/lib/date-format'
import { fetchEngagementPublicApi } from '@/lib/engagement-public-api'
import type { Comment } from '@/lib/comments'

interface NoteCommentPanelProps {
  noteId: string
}

function PreviewCommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="rounded-[14px] border border-black/5 bg-white/30 px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-semibold tracking-tight text-foreground/90">{comment.author}</span>
        <span className="text-[11px] text-muted-foreground/55">{formatCommentTimeLabel(comment.created_at, comment.updated_at)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.6] text-foreground/70">{comment.content}</p>
    </div>
  )
}

export function NoteCommentPanel({ noteId }: NoteCommentPanelProps) {
  const [phase, setPhase] = useState<'preview' | 'full'>('preview')
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  // Start as loading=true; only flipped to false inside async callbacks.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const params = new URLSearchParams({ target_type: 'note', target_id: noteId })
    void fetchEngagementPublicApi(`/api/comments?${params.toString()}`)
      .then((res) => (res.ok ? (res.json() as Promise<Comment[]>) : []))
      .then((data) => {
        if (cancelled) return
        setComments(data)
        setTotal(data.length)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [noteId])

  if (phase === 'full') {
    return (
      <div className="mt-4 border-t border-border/25 pt-4">
        <CommentBox targetType="note" targetId={noteId} initialComments={comments} />
      </div>
    )
  }

  const previewItems = comments.filter((c) => !c.parent_id).slice(0, 2)

  return (
    <div className="mt-4 space-y-2 border-t border-border/25 pt-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
      {loading ? (
        <div className="h-[52px] animate-pulse rounded-[14px] bg-muted/25" />
      ) : previewItems.length > 0 ? (
        previewItems.map((comment) => (
          <PreviewCommentCard key={comment.id} comment={comment} />
        ))
      ) : null}
      <button
        type="button"
        className="mt-1 text-[12px] font-medium text-muted-foreground/60 transition hover:text-foreground/80"
        onClick={() => setPhase('full')}
      >
        {loading
          ? '加载评论中…'
          : total > 0
            ? `查看全部 ${total} 条评论 · 写评论`
            : '写第一条评论'}
      </button>
    </div>
  )
}
