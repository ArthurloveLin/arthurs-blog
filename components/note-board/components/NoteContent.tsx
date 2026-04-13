'use client'

import type { ReactNode } from 'react'
import styles from '@/components/note-board/styles/StickyNote.module.css'
import { parseNoteContent } from '@/components/note-board/utils/editor'

interface NoteContentProps {
  content: string
  variant: 'preview' | 'board'
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

export function NoteContent({ content, variant }: NoteContentProps) {
  const parsed = parseNoteContent(content)
  const bodyLines = parsed.body.length > 0 ? parsed.body.split('\n') : []
  const textClassName = [styles.text, variant === 'preview' ? styles.previewText : styles.boardText].join(' ')

  return (
    <div className="space-y-3">
      {bodyLines.length > 0 ? (
        <div className={textClassName}>
          {bodyLines.map((line, index) => (
            <p key={`${variant}-body-${index}`} className="w-full whitespace-pre-wrap break-words">
              {line.length > 0 ? renderInlineFormattedText(line, `${variant}-${index}`) : <span>&nbsp;</span>}
            </p>
          ))}
        </div>
      ) : null}
      {parsed.checklistItems.length > 0 ? (
        <ul className="space-y-1.5 text-sm leading-relaxed text-slate-800/90">
          {parsed.checklistItems.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-700/35 text-[10px]">
                {item.checked ? 'x' : ''}
              </span>
              <span className={item.checked ? 'line-through text-slate-700/65' : ''}>{renderInlineFormattedText(item.text, `${variant}-check-${item.id}`)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}