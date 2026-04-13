'use client'

import type { ReactNode } from 'react'
import styles from '@/components/note-board/styles/StickyNote.module.css'

interface NoteActionButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

export function NoteActionButton({ label, onClick, children }: NoteActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={styles.iconButton}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
      <span className={styles.iconTooltip}>{label}</span>
    </button>
  )
}