'use client'

import { ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ReactionValue } from '@/lib/comment-reactions'

interface ReactionToggleBarProps {
  upvotes: number
  downvotes: number
  viewerReaction: ReactionValue
  pending?: boolean
  onReact: (value: 1 | -1) => void
  compact?: boolean
  className?: string
}

export default function ReactionToggleBar({
  upvotes,
  downvotes,
  viewerReaction,
  pending = false,
  onReact,
  compact = false,
  className = '',
}: ReactionToggleBarProps) {
  const containerClassName = compact ? 'gap-1.5 text-[10px]' : 'gap-2 text-[11px]'
  const buttonClassName = compact
    ? 'h-7 rounded-full px-2.5'
    : 'h-8 rounded-full px-3'

  return (
    <div className={['flex items-center', containerClassName, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        aria-pressed={viewerReaction === 1}
        disabled={pending}
        onClick={() => onReact(1)}
        className={[
          'inline-flex items-center gap-1.5 border transition-all duration-200 ease-out',
          buttonClassName,
          viewerReaction === 1
            ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700 shadow-[0_8px_18px_-14px_rgba(16,185,129,0.8)]'
            : 'border-black/10 bg-white/55 text-slate-500 hover:border-emerald-200 hover:text-emerald-700',
          pending && viewerReaction === 1 ? 'scale-[1.04] -translate-y-px animate-pulse' : '',
          pending ? 'cursor-wait opacity-70' : '',
        ].filter(Boolean).join(' ')}
      >
        <ThumbsUp size={compact ? 12 : 14} strokeWidth={1.9} />
        <span className="tabular-nums transition-transform duration-200">{upvotes}</span>
      </button>
      <button
        type="button"
        aria-pressed={viewerReaction === -1}
        disabled={pending}
        onClick={() => onReact(-1)}
        className={[
          'inline-flex items-center gap-1.5 border transition-all duration-200 ease-out',
          buttonClassName,
          viewerReaction === -1
            ? 'border-amber-300/70 bg-amber-50 text-amber-700 shadow-[0_8px_18px_-14px_rgba(245,158,11,0.8)]'
            : 'border-black/10 bg-white/55 text-slate-500 hover:border-amber-200 hover:text-amber-700',
          pending && viewerReaction === -1 ? 'scale-[1.04] -translate-y-px animate-pulse' : '',
          pending ? 'cursor-wait opacity-70' : '',
        ].filter(Boolean).join(' ')}
      >
        <ThumbsDown size={compact ? 12 : 14} strokeWidth={1.9} />
        <span className="tabular-nums transition-transform duration-200">{downvotes}</span>
      </button>
    </div>
  )
}