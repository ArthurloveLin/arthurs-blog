'use client'

import { Check } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import styles from '@/components/note-board/styles/StickyNote.module.css'
import { parseNoteContent } from '@/components/note-board/utils/editor'

interface NoteContentProps {
  content: string
  variant: 'preview' | 'board'
  onToggleChecklistItem?: (lineIndex: number) => void
  checklistPending?: boolean
}

function renderInlineFormattedText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|==[^=\n]+==|`[^`]+`)/g
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
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-code-${index}`} className={styles.inlineCode}>{token.slice(1, -1)}</code>)
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

function NoteContentComponent({ content, variant, onToggleChecklistItem, checklistPending = false }: NoteContentProps) {
  const parsed = useMemo(() => parseNoteContent(content), [content])
  const bodyElements = useMemo(() => {
    if (parsed.body.length === 0) return []
    
    const lines = parsed.body.split('\n')
    const result: ReactNode[] = []
    let inCodeBlock = false
    let currentCode: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // Close block
          result.push(
            <pre key={`body-code-${i}`} className={styles.codeBlock}>
              <code>{currentCode.join('\n')}</code>
            </pre>
          )
          currentCode = []
          inCodeBlock = false
        } else {
          // Open block
          inCodeBlock = true
        }
        continue
      }

      if (inCodeBlock) {
        currentCode.push(line)
      } else {
        result.push(
          <p key={`body-text-${i}`} className="w-full whitespace-pre-wrap break-words">
            {line.length > 0 ? renderInlineFormattedText(line, `${variant}-${i}`) : <span>&nbsp;</span>}
          </p>
        )
      }
    }

    // Handle unclosed code block
    if (inCodeBlock && currentCode.length > 0) {
      result.push(
        <pre key={`body-code-final`} className={styles.codeBlock}>
          <code>{currentCode.join('\n')}</code>
        </pre>
      )
    }

    return result
  }, [parsed.body, variant])

  const textClassName = [styles.text, variant === 'preview' ? styles.previewText : styles.boardText].join(' ')

  return (
    <div className="space-y-3">
      {bodyElements.length > 0 ? (
        <div className={textClassName}>
          {bodyElements}
        </div>
      ) : null}
      {parsed.checklistItems.length > 0 ? (
        <ul className="space-y-1.5 text-sm leading-relaxed text-slate-800/90">
          {parsed.checklistItems.map((item) => {
            const lineIndex = typeof item.lineIndex === 'number' ? item.lineIndex : null

            return (
              <li key={item.id} className="flex items-start gap-2">
                {onToggleChecklistItem && lineIndex !== null ? (
                <button
                  type="button"
                  aria-label={item.checked ? `取消勾选：${item.text}` : `勾选清单项：${item.text}`}
                  className="flex w-full items-start gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={checklistPending}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleChecklistItem(lineIndex)
                  }}
                >
                  <span className={[
                    'mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors',
                    item.checked
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-700/35 text-transparent',
                  ].join(' ')}>
                    <Check size={10} strokeWidth={2.4} />
                  </span>
                  <span className={item.checked ? 'line-through text-slate-700/65' : ''}>
                    {renderInlineFormattedText(item.text, `${variant}-check-${item.id}`)}
                  </span>
                </button>
                ) : (
                  <>
                    <span className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-700/35 text-[10px]">
                      {item.checked ? 'x' : ''}
                    </span>
                    <span className={item.checked ? 'line-through text-slate-700/65' : ''}>{renderInlineFormattedText(item.text, `${variant}-check-${item.id}`)}</span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export const NoteContent = memo(NoteContentComponent)
