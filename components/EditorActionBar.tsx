import type { ReactNode } from 'react'

interface EditorActionBarProps {
  leading?: ReactNode
  trailing?: ReactNode
  className?: string
}

export default function EditorActionBar({ leading, trailing, className }: EditorActionBarProps) {
  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground/85',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">{trailing}</div>
    </div>
  )
}