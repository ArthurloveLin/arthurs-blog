'use client'

import { SmilePlus, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactionValue } from '@/lib/comment-reactions'
import { COMMON_REACTION_EMOJIS } from '@/lib/emoji'

interface ReactionToggleBarProps {
  upvotes: number
  downvotes: number
  viewerReaction: ReactionValue
  pending?: boolean
  onReact: (value: 1 | -1) => void
  onEmojiReact?: (emoji: string) => void
  viewerEmoji?: string | null
  emojiPending?: boolean
  compact?: boolean
  className?: string
}

export default function ReactionToggleBar({
  upvotes,
  downvotes,
  viewerReaction,
  pending = false,
  onReact,
  onEmojiReact,
  viewerEmoji = null,
  emojiPending = false,
  compact = false,
  className = '',
}: ReactionToggleBarProps) {
  const [wheelOpen, setWheelOpen] = useState(false)
  const pressTimerRef = useRef<number | null>(null)
  const suppressLikeClickRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerClassName = compact ? 'gap-1.5 text-[10px]' : 'gap-2 text-[11px]'
  const buttonClassName = compact
    ? 'h-7 rounded-full px-2.5'
    : 'h-8 rounded-full px-3'

  function clearLongPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!wheelOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setWheelOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setWheelOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [wheelOpen])

  useEffect(() => () => clearLongPressTimer(), [])

  function startLongPress() {
    if (!onEmojiReact || pending || emojiPending) {
      return
    }

    clearLongPressTimer()
    pressTimerRef.current = window.setTimeout(() => {
      suppressLikeClickRef.current = true
      setWheelOpen(true)
    }, 360)
  }

  function handleLikeClick() {
    if (suppressLikeClickRef.current) {
      suppressLikeClickRef.current = false
      return
    }

    onReact(1)
  }

  return (
    <div ref={containerRef} className={['flex items-center', containerClassName, className].filter(Boolean).join(' ')}>
      <div className="relative inline-flex">
        <button
          type="button"
          aria-pressed={viewerReaction === 1}
          disabled={pending}
          onPointerDown={startLongPress}
          onPointerUp={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onClick={handleLikeClick}
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

        {onEmojiReact ? (
          <div className={['emoji-radial-wheel', wheelOpen ? 'emoji-radial-wheel--open' : ''].join(' ')}>
            {COMMON_REACTION_EMOJIS.map((emoji, index) => (
              <button
                key={emoji}
                type="button"
                className={[
                  'emoji-radial-wheel__item',
                  viewerEmoji === emoji ? 'emoji-radial-wheel__item--active' : '',
                ].filter(Boolean).join(' ')}
                style={{ ['--emoji-index' as string]: String(index), ['--emoji-total' as string]: String(COMMON_REACTION_EMOJIS.length) }}
                onClick={() => {
                  onEmojiReact(emoji)
                  setWheelOpen(false)
                }}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
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
      {onEmojiReact ? (
        <button
          type="button"
          aria-label="选择 emoji 反应"
          title="选择 emoji 反应"
          disabled={emojiPending}
          onClick={() => setWheelOpen((current) => !current)}
          className={[
            'inline-flex items-center justify-center rounded-full border transition-all duration-200 ease-out',
            compact ? 'h-7 w-7' : 'h-8 w-8',
            viewerEmoji
              ? 'border-primary/30 bg-primary/8 text-primary shadow-[0_8px_18px_-14px_rgba(124,58,237,0.8)]'
              : 'border-black/10 bg-white/55 text-slate-500 hover:border-primary/20 hover:text-primary',
            emojiPending ? 'cursor-wait opacity-70' : '',
          ].join(' ')}
        >
          <SmilePlus size={compact ? 12 : 14} strokeWidth={1.9} />
        </button>
      ) : null}
    </div>
  )
}