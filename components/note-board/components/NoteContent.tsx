'use client'

import { Check } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import styles from '@/components/note-board/styles/StickyNote.module.css'
import { parseNoteContent } from '@/components/note-board/utils/editor'

interface NoteContentProps {
  content: string
  variant: 'preview' | 'board' | 'stream'
  onToggleChecklistItem?: (lineIndex: number) => void
  checklistPending?: boolean
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|==[^=\n]+==|`[^`\n]+`|~~[^~\n]+~~|\[[^\]]+\]\([^)]+\)|#[\w一-龥]+)/g

function renderInlineFormattedText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  let index = 0
  INLINE_PATTERN.lastIndex = 0
  let match = INLINE_PATTERN.exec(text)

  while (match) {
    const [token] = match
    const tokenStart = match.index

    if (tokenStart > cursor) {
      nodes.push(text.slice(cursor, tokenStart))
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-i-${index}`} className="italic">{token.slice(1, -1)}</em>)
    } else if (token.startsWith('==') && token.endsWith('==')) {
      nodes.push(<mark key={`${keyPrefix}-m-${index}`} className="rounded-[0.35em] bg-amber-200/85 px-1 py-[0.05em] text-slate-900">{token.slice(2, -2)}</mark>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c-${index}`} className={styles.inlineCode}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(<del key={`${keyPrefix}-s-${index}`} className="opacity-60">{token.slice(2, -2)}</del>)
    } else if (token.startsWith('#')) {
      nodes.push(
        <span key={`${keyPrefix}-tag-${index}`} className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-[0.8em] text-muted-foreground">
          {token}
        </span>
      )
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        const rawHref = linkMatch[2]
        const href = /^(https?:\/\/|mailto:|tel:|#|\/)/.test(rawHref)
          ? rawHref
          : `https://${rawHref}`
        nodes.push(
          <a
            key={`${keyPrefix}-a-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        nodes.push(token)
      }
    }

    cursor = tokenStart + token.length
    index += 1
    match = INLINE_PATTERN.exec(text)
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes.length > 0 ? nodes : [text]
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/
const BLOCKQUOTE_PATTERN = /^>\s?(.*)$/
const HR_PATTERN = /^---+$/
const TABLE_ROW_PATTERN = /^\|.+\|$/
const INLINE_IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)]+)\)$/
const UL_PATTERN = /^[-*+]\s+(.+)$/
const OL_PATTERN = /^\d+\.\s+(.+)$/

// Board / preview variant: em-relative so they scale with the sticky note font
const HEADING_CLASS_NOTE: Record<number, string> = {
  1: 'text-[1.15em] font-bold leading-snug text-slate-900',
  2: 'text-[1.08em] font-bold leading-snug text-slate-900',
  3: 'text-[1em] font-semibold leading-snug text-slate-800',
  4: 'text-[0.95em] font-semibold text-slate-800',
  5: 'text-[0.9em] font-medium text-slate-700',
  6: 'text-[0.85em] font-medium text-slate-600',
}

// Stream variant: absolute px so the hierarchy is clear against the 13.5 px body
const HEADING_CLASS_STREAM: Record<number, string> = {
  1: 'text-[22px] font-bold leading-tight tracking-tight text-slate-900 border-b border-slate-200 pb-1.5 mt-6 mb-3',
  2: 'text-[18px] font-bold leading-tight text-slate-800 border-b border-slate-200/60 pb-1 mt-5 mb-2',
  3: 'text-[16px] font-semibold leading-snug text-slate-800 mt-4 mb-1',
  4: 'text-[14px] font-semibold text-slate-800 mt-3 mb-0.5',
  5: 'text-[12.5px] font-semibold text-slate-700 mt-2',
  6: 'text-[12px] font-medium text-slate-500 mt-2',
}

function renderTableRows(rows: string[], keyPrefix: string): ReactNode {
  const parsed = rows.map((row) =>
    row.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
  )

  const isHeader = parsed.length >= 2 && parsed[1]?.every((cell) => /^-+$/.test(cell))
  const headerRow = isHeader ? parsed[0] : null
  const bodyRows = isHeader ? parsed.slice(2) : parsed

  return (
    <div key={`${keyPrefix}-table`} className="my-1 w-full overflow-x-auto">
      <table className="w-full border-collapse text-[0.85em]">
        {headerRow && (
          <thead>
            <tr>
              {headerRow.map((cell, ci) => (
                <th key={ci} className="border border-slate-300/60 bg-slate-100/60 px-1.5 py-0.5 text-left font-semibold text-slate-800">
                  {renderInlineFormattedText(cell, `${keyPrefix}-th-${ci}`)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((cells, ri) => (
            <tr key={ri}>
              {cells.map((cell, ci) => (
                <td key={ci} className="border border-slate-300/60 px-1.5 py-0.5 text-slate-700">
                  {renderInlineFormattedText(cell, `${keyPrefix}-td-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NoteContentComponent({ content, variant, onToggleChecklistItem, checklistPending = false }: NoteContentProps) {
  const parsed = useMemo(() => parseNoteContent(content), [content])

  const bodyElements = useMemo(() => {
    if (parsed.body.length === 0) return []

    const lines = parsed.body.split('\n')
    const result: ReactNode[] = []
    let inCodeBlock = false
    let currentCode: string[] = []
    let tableBuffer: string[] = []
    let tableStart = 0
    let listBuffer: string[] = []
    let listType: 'ul' | 'ol' | null = null
    let listStart = 0

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function flushTable(_untilIndex: number) {
      if (tableBuffer.length === 0) return
      result.push(renderTableRows(tableBuffer, `${variant}-tbl-${tableStart}`))
      tableBuffer = []
    }

    const isStream = variant === 'stream'

    function flushList() {
      if (listBuffer.length === 0 || !listType) return
      const Tag = listType
      const ulCls = isStream ? 'my-2 ml-5 list-disc space-y-1' : 'my-1 ml-4 list-disc space-y-0.5'
      const olCls = isStream ? 'my-2 ml-5 list-decimal space-y-1' : 'my-1 ml-4 list-decimal space-y-0.5'
      result.push(
        <Tag key={`${variant}-${listType}-${listStart}`} className={listType === 'ul' ? ulCls : olCls}>
          {listBuffer.map((text, idx) => (
            <li key={idx} className="pl-0.5">
              {renderInlineFormattedText(text, `${variant}-li-${listStart}-${idx}`)}
            </li>
          ))}
        </Tag>
      )
      listBuffer = []
      listType = null
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Code block fence
      if (line.startsWith('```')) {
        flushTable(i)
        flushList()
        if (inCodeBlock) {
          result.push(
            <pre key={`cb-${i}`} className={styles.codeBlock}>
              <code>{currentCode.join('\n')}</code>
            </pre>
          )
          currentCode = []
          inCodeBlock = false
        } else {
          inCodeBlock = true
        }
        continue
      }

      if (inCodeBlock) {
        currentCode.push(line)
        continue
      }

      // Table rows
      if (TABLE_ROW_PATTERN.test(line)) {
        flushList()
        if (tableBuffer.length === 0) tableStart = i
        tableBuffer.push(line)
        continue
      } else {
        flushTable(i)
      }

      // Unordered list
      const ulMatch = line.match(UL_PATTERN)
      if (ulMatch) {
        if (listType === 'ol') flushList()
        if (listBuffer.length === 0) { listType = 'ul'; listStart = i }
        listBuffer.push(ulMatch[1])
        continue
      }

      // Ordered list
      const olMatch = line.match(OL_PATTERN)
      if (olMatch) {
        if (listType === 'ul') flushList()
        if (listBuffer.length === 0) { listType = 'ol'; listStart = i }
        listBuffer.push(olMatch[1])
        continue
      }

      // Non-list line flushes any open list
      flushList()

      // Heading
      const headingMatch = line.match(HEADING_PATTERN)
      if (headingMatch) {
        const level = Math.min(headingMatch[1].length, 6) as 1 | 2 | 3 | 4 | 5 | 6
        const headingClass = isStream ? HEADING_CLASS_STREAM[level] : HEADING_CLASS_NOTE[level]
        result.push(
          <p key={`h-${i}`} className={`w-full ${headingClass}`}>
            {renderInlineFormattedText(headingMatch[2], `${variant}-h-${i}`)}
          </p>
        )
        continue
      }

      // Blockquote
      const bqMatch = line.match(BLOCKQUOTE_PATTERN)
      if (bqMatch) {
        const bqCls = isStream
          ? 'border-l-4 border-slate-300 pl-4 my-1.5 text-slate-500'
          : 'border-l-2 border-slate-400/60 pl-2 italic text-slate-600/90'
        result.push(
          <blockquote key={`bq-${i}`} className={bqCls}>
            {bqMatch[1].length > 0
              ? renderInlineFormattedText(bqMatch[1], `${variant}-bq-${i}`)
              : <span>&nbsp;</span>}
          </blockquote>
        )
        continue
      }

      // HR
      if (HR_PATTERN.test(line)) {
        result.push(<hr key={`hr-${i}`} className={isStream ? 'my-4 border-slate-200' : 'my-1 border-slate-300/60'} />)
        continue
      }

      // Block image
      const imgMatch = line.match(INLINE_IMAGE_PATTERN)
      if (imgMatch) {
        result.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`img-${i}`}
            src={imgMatch[2]}
            alt={imgMatch[1] || ''}
            className="mt-1 max-w-full rounded-lg"
            loading="lazy"
            onPointerDown={(e) => e.stopPropagation()}
          />
        )
        continue
      }

      // Regular paragraph
      result.push(
        <p key={`p-${i}`} className="w-full whitespace-pre-wrap break-words">
          {line.length > 0 ? renderInlineFormattedText(line, `${variant}-${i}`) : <span>&nbsp;</span>}
        </p>
      )
    }

    // Flush trailing table, list, or code block
    flushTable(lines.length)
    flushList()
    if (inCodeBlock && currentCode.length > 0) {
      result.push(
        <pre key="cb-final" className={styles.codeBlock}>
          <code>{currentCode.join('\n')}</code>
        </pre>
      )
    }

    return result
  }, [parsed.body, variant])

  const textClassName = variant === 'stream'
    ? styles.streamText
    : [styles.text, variant === 'preview' ? styles.previewText : styles.boardText].join(' ')

  return (
    <div className="space-y-3">
      {bodyElements.length > 0 ? (
        <div className={textClassName}>
          {bodyElements}
        </div>
      ) : null}
      {parsed.checklistItems.length > 0 ? (
        <ul className={`space-y-1.5 leading-relaxed text-slate-800/90 ${variant === 'stream' ? 'text-[13.5px]' : 'text-[1.05rem]'}`}>
          {parsed.checklistItems.map((item) => {
            const lineIndex = typeof item.lineIndex === 'number' ? item.lineIndex : null

            return (
              <li key={item.id} className="flex items-start gap-2">
                {onToggleChecklistItem && lineIndex !== null ? (
                  <>
                    <button
                      type="button"
                      aria-label={item.checked ? `取消勾选：${item.text}` : `勾选清单项：${item.text}`}
                      className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={checklistPending}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleChecklistItem(lineIndex)
                      }}
                    >
                      <span className={[
                        'inline-flex h-full w-full items-center justify-center rounded-full',
                        item.checked
                          ? 'border-slate-400/60 bg-slate-400/30 text-slate-500'
                          : 'border-slate-700/35 text-transparent',
                      ].join(' ')}>
                        <Check size={10} strokeWidth={2.4} />
                      </span>
                    </button>
                    <span
                      className={item.checked ? 'line-through text-slate-700/65' : ''}
                    >
                      {renderInlineFormattedText(item.text, `${variant}-check-${item.id}`)}
                    </span>
                  </>
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
