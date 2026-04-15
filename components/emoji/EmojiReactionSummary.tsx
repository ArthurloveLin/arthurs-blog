'use client'

import type { EmojiReactionEntry } from '@/lib/comment-emojis'

interface EmojiReactionSummaryProps {
  entries: EmojiReactionEntry[]
  viewerEmoji?: string | null
  onSelect?: (emoji: string) => void
  className?: string
}

export default function EmojiReactionSummary({
  entries,
  viewerEmoji = null,
  onSelect,
  className = '',
}: EmojiReactionSummaryProps) {
  if (entries.length === 0) {
    return null
  }

  return (
    <div className={['flex flex-wrap items-center gap-1.5', className].filter(Boolean).join(' ')}>
      {entries.slice(0, 6).map((entry) => {
        const active = entry.viewer || entry.emoji === viewerEmoji
        const sharedClassName = [
          'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition',
          active
            ? 'border-primary/30 bg-primary/8 text-slate-900 shadow-[0_8px_20px_-16px_rgba(124,58,237,0.65)]'
            : 'border-black/8 bg-white/65 text-slate-600 hover:bg-white',
        ].join(' ')

        if (onSelect) {
          return (
            <button
              key={entry.emoji}
              type="button"
              className={sharedClassName}
              onClick={() => onSelect(entry.emoji)}
            >
              <span className="text-sm leading-none">{entry.emoji}</span>
              <span className="tabular-nums">{entry.count}</span>
            </button>
          )
        }

        return (
          <span key={entry.emoji} className={sharedClassName}>
            <span className="text-sm leading-none">{entry.emoji}</span>
            <span className="tabular-nums">{entry.count}</span>
          </span>
        )
      })}
    </div>
  )
}