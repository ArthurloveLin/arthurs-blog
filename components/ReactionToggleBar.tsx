'use client'

import { ThumbsDown, ThumbsUp } from 'lucide-react'
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
  viewerEmojis?: string[]
  emojiPending?: boolean
  compact?: boolean
  variant?: 'pill' | 'bare'
  className?: string
}

export default function ReactionToggleBar({
  upvotes,
  downvotes,
  viewerReaction,
  pending = false,
  onReact,
  onEmojiReact,
  viewerEmojis = [],
  emojiPending = false,
  compact = false,
  variant = 'pill',
  className = '',
}: ReactionToggleBarProps) {
  const [wheelOpen, setWheelOpen] = useState(false)
  const pressTimerRef = useRef<number | null>(null)
  const suppressLikeClickRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const likeButtonRef = useRef<HTMLButtonElement>(null)
  const containerClassName = compact ? 'gap-1.5 text-[10px]' : 'gap-2 text-[11px]'
  const buttonClassName = variant === 'bare'
    ? compact
      ? 'h-7 px-0.5'
      : 'h-8 px-1'
    : compact
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
      <div className="relative inline-flex items-center justify-center">
        <button
          ref={likeButtonRef}
          type="button"
          aria-pressed={viewerReaction === 1}
          disabled={pending}
          onPointerDown={startLongPress}
          onPointerUp={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onClick={handleLikeClick}
          onContextMenu={(event) => {
            if (!onEmojiReact || pending || emojiPending) {
              return
            }

            event.preventDefault()
            clearLongPressTimer()
            setWheelOpen(true)
          }}
          title={onEmojiReact ? '点赞，长按或右键可选择 emoji' : undefined}
          className={[
            'inline-flex items-center gap-1.5 transition-all duration-200 ease-out',
            buttonClassName,
            variant === 'bare'
              ? viewerReaction === 1
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-emerald-700'
              : viewerReaction === 1
                ? 'border border-emerald-300/70 bg-emerald-50 text-emerald-700 shadow-[0_8px_18px_-14px_rgba(16,185,129,0.8)]'
                : 'border border-black/10 bg-white/55 text-slate-500 hover:border-emerald-200 hover:text-emerald-700',
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
                  viewerEmojis.includes(emoji) ? 'emoji-radial-wheel__item--active' : '',
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
        onClick={() => {
          setWheelOpen(false)
          onReact(-1)
        }}
        className={[
          'inline-flex items-center gap-1.5 transition-all duration-200 ease-out',
          buttonClassName,
          variant === 'bare'
            ? viewerReaction === -1
              ? 'text-amber-700'
              : 'text-slate-500 hover:text-amber-700'
            : viewerReaction === -1
              ? 'border border-amber-300/70 bg-amber-50 text-amber-700 shadow-[0_8px_18px_-14px_rgba(245,158,11,0.8)]'
              : 'border border-black/10 bg-white/55 text-slate-500 hover:border-amber-200 hover:text-amber-700',
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