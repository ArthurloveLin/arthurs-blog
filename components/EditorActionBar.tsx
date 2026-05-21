import type { ReactNode } from 'react'

interface EditorActionBarProps {
  leading?: ReactNode
  trailing?: ReactNode
  className?: string
  noWrap?: boolean
}

export default function EditorActionBar({ leading, trailing, className, noWrap = false }: EditorActionBarProps) {
  return (
    <div
      className={[
        noWrap
          ? 'flex flex-nowrap items-center gap-2 overflow-x-auto border-t border-border/60 px-3 py-2 text-xs text-muted-foreground/85'
          : 'flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground/85',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className={noWrap ? 'flex flex-nowrap items-center gap-1.5' : 'flex min-w-0 flex-wrap items-center gap-2'}>{leading}</div>
      <div className={noWrap ? 'ml-auto flex shrink-0 flex-nowrap items-center gap-1.5' : 'flex flex-wrap items-center justify-end gap-2'}>{trailing}</div>
    </div>
  )
}