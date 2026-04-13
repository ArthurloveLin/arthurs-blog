'use client'

import { Archive, ArchiveRestore, ArrowRight, Bold, Check, ChevronLeft, ChevronRight, Highlighter, Italic, LayoutList, Layers, ListTodo, PencilLine, RotateCcw, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useAuth } from '@/components/AuthProvider'
import EditorActionBar from '@/components/EditorActionBar'
import { formatCommentTimeLabel } from '@/lib/date-format'
import type { NoteBoardSlug, NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

const STICKY_COLORS = ['#f8ef9f', '#ffd0a8', '#f8bfd3', '#c9eff3', '#d9ccff']
const NOTE_CARD_WIDTH = 200
const PREVIEW_CARD_SIZE = 200
const PREVIEW_STACK_LIMIT = 6
const PREVIEW_REVEAL_THRESHOLD = 112
const MOBILE_SIDE_PEEK_RATIO = 0.22
const MOBILE_COLLECT_STAGGER_MS = 110

interface Size {
  width: number
  height: number
}

interface NotePosition {
  x: number
  y: number
  rotation: number
}

interface NoteBoardPageProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
}

interface ChecklistItemDraft {
  id: string
  text: string
  checked: boolean
  lineIndex?: number
}

interface StickyStackPreviewProps {
  board: NoteBoardViewConfig
  messages: NoteMessage[]
}

interface StickyNoteCardProps {
  message: NoteMessage
  x: number
  y: number
  rotation: number
  zIndex: number
  width: number
  bounds: Size
  colorIndex: number
  draggable: boolean
  variant: 'preview' | 'board'
  showDelete?: boolean
  showEdit?: boolean
  showArchive?: boolean
  ctaHref?: string
  ctaLabel?: string
  animatePosition?: boolean
  dragBoundsMode?: 'contained' | 'mobile-stack'
  onDelete?: () => void
  onEdit?: () => void
  onToggleArchive?: () => void
  onLift?: () => void
  onCommit?: (nextPosition: NotePosition, metrics: { distance: number }) => void
}

interface TextSelectionRange {
  start: number
  end: number
}

interface TextEditResult {
  value: string
  selection: TextSelectionRange
}

interface NoteEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  saveLabel: string
  isSaving: boolean
  onSave: () => void
  onCancel?: () => void
  saveDisabled?: boolean
  maxLength?: number
  minHeightClassName?: string
  shellClassName?: string
  toolbarClassName?: string
  autoFocus?: boolean
}

interface ToastNotice {
  id: number
  message: string
}

interface OptimisticMessageSnapshot {
  message: NoteMessage
  index: number
  customPosition?: NotePosition
  zIndex?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sanitizeNotePosition(position: NotePosition): NotePosition {
  return {
    x: Number.isFinite(position.x) ? position.x : 0,
    y: Number.isFinite(position.y) ? position.y : 0,
    rotation: Number.isFinite(position.rotation) ? position.rotation : 0,
  }
}

function seededUnit(seed: string, salt: number) {
  let hash = salt * 374761393
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash ^ seed.charCodeAt(index)) * 668265263
  }

  const normalized = Math.sin(hash) * 43758.5453
  return normalized - Math.floor(normalized)
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

function getStickyColorIndex(seed: string) {
  return Math.floor(seededUnit(seed, 7) * STICKY_COLORS.length)
}

function buildChecklistItem(text = '', checked = false, id?: string): ChecklistItemDraft {
  return {
    id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    checked,
  }
}

const CHECKLIST_PARSE_PATTERN = /^[-*]\s+\[( |x|X)\]\s+(.*)$/

function getSelectionBlock(value: string, start: number, end: number) {
  const safeStart = clamp(start, 0, value.length)
  const safeEnd = clamp(end, 0, value.length)
  const blockStart = value.lastIndexOf('\n', Math.max(safeStart - 1, 0)) + 1
  const nextBreak = value.indexOf('\n', safeEnd)
  const blockEnd = nextBreak === -1 ? value.length : nextBreak

  return {
    start: blockStart,
    end: blockEnd,
    text: value.slice(blockStart, blockEnd),
  }
}

function replaceRange(value: string, start: number, end: number, insertion: string, selectionStart: number, selectionEnd = selectionStart): TextEditResult {
  return {
    value: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
    selection: { start: selectionStart, end: selectionEnd },
  }
}

function wrapSelectionWithSyntax(value: string, start: number, end: number, prefix: string, suffix = prefix): TextEditResult {
  const selectedText = value.slice(start, end)
  const insertion = `${prefix}${selectedText}${suffix}`
  const caretStart = start + prefix.length
  const caretEnd = selectedText ? end + prefix.length : caretStart
  return replaceRange(value, start, end, insertion, caretStart, caretEnd)
}

function insertChecklistSyntax(value: string, start: number, end: number): TextEditResult {
  if (start !== end) {
    const block = getSelectionBlock(value, start, end)
    const converted = block.text
      .split('\n')
      .map((line) => {
        const normalized = line.replace(/^[-*]\s+\[(?: |x|X)\]\s+/, '').trim()
        return `- [ ] ${normalized}`
      })
      .join('\n')

    return replaceRange(value, block.start, block.end, converted, block.start, block.start + converted.length)
  }

  const block = getSelectionBlock(value, start, end)
  if (block.text.trim().length === 0) {
    return replaceRange(value, block.start, block.end, '- [ ] ', block.start + 6)
  }

  const prefix = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
  const insertion = `${prefix}- [ ] `
  return replaceRange(value, start, end, insertion, start + insertion.length)
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

function ToolbarIconButton({
  onClick,
  label,
  children,
  disabled = false,
  emphasize = false,
}: {
  onClick: () => void
  label: string
  children: ReactNode
  disabled?: boolean
  emphasize?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${emphasize ? 'border-slate-900 bg-slate-900 text-white hover:opacity-90 disabled:border-slate-400 disabled:bg-slate-400' : 'border-black/10 bg-white/70 text-slate-700 hover:bg-white disabled:opacity-40'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function NoteEditor({
  value,
  onChange,
  placeholder,
  saveLabel,
  isSaving,
  onSave,
  onCancel,
  saveDisabled = false,
  maxLength,
  minHeightClassName = 'min-h-[108px]',
  shellClassName = 'overflow-hidden rounded-[18px] border border-black/10 bg-white/45',
  toolbarClassName = 'px-3 py-2 text-[11px] text-slate-700',
  autoFocus = false,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<TextSelectionRange | null>(null)

  useEffect(() => {
    if (!pendingSelectionRef.current || !textareaRef.current) return

    const nextSelection = pendingSelectionRef.current
    pendingSelectionRef.current = null
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(nextSelection.start, nextSelection.end)
  }, [value])

  useEffect(() => {
    if (!autoFocus || !textareaRef.current) return

    textareaRef.current.focus()
    const caret = textareaRef.current.value.length
    textareaRef.current.setSelectionRange(caret, caret)
  }, [autoFocus])

  function commitTextEdit(result: TextEditResult) {
    const nextValue = typeof maxLength === 'number' ? result.value.slice(0, maxLength) : result.value
    const nextSelection = {
      start: clamp(result.selection.start, 0, nextValue.length),
      end: clamp(result.selection.end, 0, nextValue.length),
    }

    pendingSelectionRef.current = nextSelection
    onChange(nextValue)
  }

  function withSelection(transform: (text: string, start: number, end: number) => TextEditResult) {
    const textarea = textareaRef.current
    if (!textarea) return
    commitTextEdit(transform(value, textarea.selectionStart, textarea.selectionEnd))
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`${minHeightClassName} w-full resize-none rounded-[18px] border border-black/10 bg-white/55 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-500/70 focus:border-black/20 focus:ring-2 focus:ring-black/10`}
      />
      <div className={shellClassName}>
        <EditorActionBar
          noWrap
          className={['border-t-0', toolbarClassName].join(' ')}
          leading={(
            <>
              <ToolbarIconButton onClick={() => withSelection(insertChecklistSyntax)} label="插入 checklist">
                <ListTodo size={12} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '**'))} label="加粗">
                <Bold size={12} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '*'))} label="斜体">
                <Italic size={12} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '=='))} label="高亮">
                <Highlighter size={12} strokeWidth={1.8} />
              </ToolbarIconButton>
            </>
          )}
          trailing={(
            <>
              {onCancel ? (
                <ToolbarIconButton onClick={onCancel} label="取消编辑">
                  <X size={12} strokeWidth={1.8} />
                </ToolbarIconButton>
              ) : null}
              <ToolbarIconButton onClick={onSave} label={isSaving ? '保存中' : saveLabel} disabled={isSaving || saveDisabled} emphasize>
                <Check size={12} strokeWidth={2} />
              </ToolbarIconButton>
            </>
          )}
        />
      </div>
    </div>
  )
}

function parseNoteContent(content: string) {
  const lines = content.split('\n')
  const bodyLines: string[] = []
  const checklistItems: ChecklistItemDraft[] = []

  for (const [index, line] of lines.entries()) {
    const match = line.match(CHECKLIST_PARSE_PATTERN)
    if (match) {
      checklistItems.push({
        ...buildChecklistItem(match[2], match[1].toLowerCase() === 'x', `parsed-${index}-${match[2]}`),
        lineIndex: index,
      })
      continue
    }

    bodyLines.push(line)
  }

  return {
    body: bodyLines.join('\n').trim(),
    checklistItems,
  }
}

function getMobileStackPosition(stackIndex: number, size: Size, cardWidth: number, messageId: string): NotePosition {
  return {
    x: (size.width - cardWidth) / 2 + Math.min(stackIndex, 4) * 4,
    y: 40 + Math.min(stackIndex, 4) * 5,
    rotation: (seededUnit(messageId, 5) - 0.5) * 6,
  }
}

function getMobileSideParkPosition(
  side: 'left' | 'right',
  releaseY: number,
  index: number,
  size: Size,
  cardWidth: number,
): NotePosition {
  const exposedWidth = cardWidth * MOBILE_SIDE_PEEK_RATIO
  const x = side === 'right' ? size.width - exposedWidth : exposedWidth - cardWidth
  const fallbackY = 18 + (index % 4) * 34
  const y = clamp(releaseY, 12, Math.max(size.height - 160, 12)) || fallbackY

  return {
    x,
    y,
    rotation: side === 'right' ? 11 : -11,
  }
}

function renderNoteContent(content: string, variant: 'preview' | 'board') {
  const parsed = parseNoteContent(content)
  const textClassName = `note-board-sticky__text ${variant === 'preview' ? 'note-board-sticky__text--preview' : 'note-board-sticky__text--board'}`
  const bodyLines = parsed.body.length > 0 ? parsed.body.split('\n') : []

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

function buildOptimisticSnapshot(
  id: string,
  messages: NoteMessage[],
  customPositions: Record<string, NotePosition>,
  cardZIndices: Record<string, number>,
): OptimisticMessageSnapshot | null {
  const index = messages.findIndex((message) => message.id === id)
  if (index === -1) return null

  return {
    message: messages[index],
    index,
    customPosition: customPositions[id],
    zIndex: cardZIndices[id],
  }
}

function NoteIconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="note-board-sticky__icon-button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
      <span className="note-board-sticky__icon-tooltip">{label}</span>
    </button>
  )
}

function getCardWidth(width: number) {
  if (width <= 0) return NOTE_CARD_WIDTH
  return clamp(width - 32, NOTE_CARD_WIDTH, NOTE_CARD_WIDTH)
}

function computeBoardLayout(messages: NoteMessage[], width: number) {
  const cardWidth = getCardWidth(width > 0 ? width / (width >= 1200 ? 4 : width >= 860 ? 3 : width >= 620 ? 2 : 1) : NOTE_CARD_WIDTH)
  const columns = width >= 1200 ? 4 : width >= 860 ? 3 : width >= 620 ? 2 : 1
  const gapX = 26
  const gapY = 30
  const columnWidth = columns === 1 ? cardWidth : Math.max((width - gapX * (columns - 1)) / columns, cardWidth)

  const layouts = messages.map((message, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const jitterX = (seededUnit(message.id, 1) - 0.5) * 34
    const jitterY = (seededUnit(message.id, 2) - 0.5) * 24
    const rotation = (seededUnit(message.id, 3) - 0.5) * 12
    const x = clamp(column * (columnWidth + gapX) + jitterX, 0, Math.max(width - cardWidth, 0))
    const y = row * (220 + gapY) + jitterY
    return { x, y, rotation, zIndex: messages.length - index, colorIndex: getStickyColorIndex(message.id) }
  })

  const height = layouts.length === 0
    ? 320
    : Math.max(...layouts.map((layout) => layout.y)) + 248

  return { cardWidth, height, layouts }
}

function getDeletePermission(board: NoteBoardSlug, isAdmin: boolean, identity: string, message: NoteMessage) {
  if (board === 'memo') return isAdmin
  return isAdmin || (!!identity && identity === message.author)
}

function getEditPermission(isAdmin: boolean, identity: string, message: NoteMessage) {
  return isAdmin || (!!identity && identity === message.author)
}

function getBoardHref(board: NoteBoardSlug) {
  return board === 'memo' ? '/memo' : '/guestbook'
}

function StickyNoteCard({
  message,
  x,
  y,
  rotation,
  zIndex,
  width,
  bounds,
  colorIndex,
  draggable,
  variant,
  showDelete = false,
  showEdit = false,
  showArchive = false,
  ctaHref,
  ctaLabel,
  animatePosition = true,
  dragBoundsMode = 'contained',
  onDelete,
  onEdit,
  onToggleArchive,
  onLift,
  onCommit,
}: StickyNoteCardProps) {
  const dragOriginRef = useRef<NotePosition | null>(null)
  const dragPointerRef = useRef<{ startClientX: number; startClientY: number } | null>(null)
  const velocityRef = useRef({ lastClientX: 0, lastClientY: 0, lastTime: 0, velocityX: 0, velocityY: 0 })
  const frameRef = useRef<number | null>(null)
  const queuedDragPositionRef = useRef<NotePosition | null>(null)
  const latestDragPositionRef = useRef<NotePosition | null>(null)
  const [dragPosition, setDragPosition] = useState<NotePosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isPreview = variant === 'preview'

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  function scheduleDragPosition(nextPosition: NotePosition) {
    latestDragPositionRef.current = nextPosition
    queuedDragPositionRef.current = nextPosition

    if (frameRef.current !== null) return

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null

      if (!queuedDragPositionRef.current) return

      setDragPosition(queuedDragPositionRef.current)
      queuedDragPositionRef.current = null
    })
  }

  const activePosition = isDragging && dragPosition ? dragPosition : { x, y, rotation }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggable) return

    onLift?.()
    dragOriginRef.current = { x, y, rotation }
    dragPointerRef.current = { startClientX: event.clientX, startClientY: event.clientY }
    velocityRef.current = {
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTime: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
    }
    setIsDragging(true)
    latestDragPositionRef.current = { x, y, rotation }
    queuedDragPositionRef.current = null
    setDragPosition({ x, y, rotation })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragOriginRef.current || !dragPointerRef.current || !isDragging) return

    const deltaX = event.clientX - dragPointerRef.current.startClientX
    const deltaY = event.clientY - dragPointerRef.current.startClientY
    const elapsed = Math.max(event.timeStamp - velocityRef.current.lastTime, 16)
    const instantVelocityX = (event.clientX - velocityRef.current.lastClientX) / elapsed
    const instantVelocityY = (event.clientY - velocityRef.current.lastClientY) / elapsed
    const velocityX = velocityRef.current.velocityX * 0.32 + instantVelocityX * 0.68
    const velocityY = velocityRef.current.velocityY * 0.32 + instantVelocityY * 0.68
    const wobble = clamp(velocityX * -140, -9, 9)
    
    const minX = dragBoundsMode === 'mobile-stack' ? -width * 0.72 : 0
    const maxX = dragBoundsMode === 'mobile-stack'
      ? Math.max(bounds.width - width * MOBILE_SIDE_PEEK_RATIO, minX)
      : Math.max(bounds.width - width, minX)
    const minY = dragBoundsMode === 'mobile-stack' ? -24 : 0
    const maxY = dragBoundsMode === 'mobile-stack'
      ? Math.max(bounds.height - 148, minY)
      : Math.max(bounds.height - (isPreview ? PREVIEW_CARD_SIZE : 200), minY)
    const nextX = clamp(dragOriginRef.current.x + deltaX, minX, maxX)
    const nextY = clamp(dragOriginRef.current.y + deltaY, minY, maxY)
    const nextRotation = dragOriginRef.current.rotation + clamp(deltaX * 0.016, -7, 7) + wobble * 0.42

    velocityRef.current = {
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTime: event.timeStamp,
      velocityX,
      velocityY,
    }

    scheduleDragPosition({ x: nextX, y: nextY, rotation: nextRotation })
  }

  function commitDrag() {
    if (!dragOriginRef.current) return

    const origin = dragOriginRef.current
    const finalPosition = latestDragPositionRef.current ?? dragPosition ?? { x, y, rotation }
    const settledRotation = clamp(finalPosition.rotation + clamp(velocityRef.current.velocityX * -120, -7, 7) * 0.4, -18, 18)
    const nextPosition = sanitizeNotePosition({
      x: finalPosition.x,
      y: finalPosition.y,
      rotation: settledRotation,
    })
    const distance = Math.hypot(finalPosition.x - origin.x, finalPosition.y - origin.y)
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    dragOriginRef.current = null
    dragPointerRef.current = null
    velocityRef.current = { lastClientX: 0, lastClientY: 0, lastTime: 0, velocityX: 0, velocityY: 0 }
    latestDragPositionRef.current = null
    queuedDragPositionRef.current = null
    setIsDragging(false)
    setDragPosition(null)
    onCommit?.(nextPosition, { distance })
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggable) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    commitDrag()
  }

  function handlePointerCancel() {
    if (!draggable) return
    commitDrag()
  }

  return (
    <article
      className={`note-board-sticky absolute touch-none select-none note-board-sticky--paper ${isPreview ? 'note-board-sticky--preview' : 'note-board-sticky--board'}`}
      style={{
        width,
        zIndex: isDragging ? 999 : zIndex,
        transform: isPreview
          ? `translate3d(${activePosition.x}px, ${activePosition.y}px, 0) rotate(${activePosition.rotation}deg)`
          : `translate3d(${activePosition.x}px, ${activePosition.y}px, 0) rotate(${activePosition.rotation}deg)`,
        transition: isDragging
          ? 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1), filter 120ms ease'
          : animatePosition
            ? 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms ease'
            : 'none',
        cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <div
        className={`note-board-sticky__paper ${isPreview ? 'note-board-sticky__paper--preview' : 'note-board-sticky__paper--board'}`}
        style={{
          backgroundColor: STICKY_COLORS[colorIndex % STICKY_COLORS.length],
          transform: `rotateX(${isDragging ? 24 : 5}deg) scale(${isDragging ? 1.08 : 1})`,
          boxShadow: isDragging
            ? '-1px 14px 40px -4px rgba(0, 0, 0, 0.16), inset 0 18px 24px -12px rgba(0, 0, 0, 0.28)'
            : '-1px 10px 5px -4px rgba(0, 0, 0, 0.12), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="note-board-sticky__meta">
          <div className="note-board-sticky__meta-copy">
            <p className="note-board-sticky__author">{message.author}</p>
            <p className={`note-board-sticky__time ${variant === 'board' ? 'note-board-sticky__time--board' : 'note-board-sticky__time--preview'}`}>
              {formatCommentTimeLabel(message.created_at, message.updated_at)}
            </p>
          </div>
          <div className="note-board-sticky__actions">
            {ctaHref && ctaLabel ? (
              <Link
                href={ctaHref}
                aria-label={ctaLabel}
                className="note-board-sticky__icon-link"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <ArrowRight size={18} strokeWidth={1.85} />
                <span className="note-board-sticky__icon-tooltip">{ctaLabel}</span>
              </Link>
            ) : null}
            {showArchive && onToggleArchive ? (
              <NoteIconAction label={message.archived ? '取消归档' : '归档便签'} onClick={onToggleArchive}>
                {message.archived ? <ArchiveRestore size={16} strokeWidth={1.9} /> : <Archive size={16} strokeWidth={1.9} />}
              </NoteIconAction>
            ) : null}
            {showEdit && onEdit && !isPreview ? (
              <NoteIconAction label="编辑便签" onClick={onEdit}>
                <PencilLine size={16} strokeWidth={1.9} />
              </NoteIconAction>
            ) : null}
            {showDelete && onDelete ? (
              <NoteIconAction label="删除便签" onClick={onDelete}>
                <Trash2 size={16} strokeWidth={1.85} />
              </NoteIconAction>
            ) : null}
          </div>
        </div>
        {renderNoteContent(message.content, variant)}
      </div>
    </article>
  )
}

export function StickyStackPreview({ board, messages }: StickyStackPreviewProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const visibleMessages = useMemo(
    () => messages.slice(0, Math.min(board.previewLimit, PREVIEW_STACK_LIMIT)),
    [messages, board.previewLimit],
  )
  const [revealedCount, setRevealedCount] = useState(0)
  const maxRevealedCount = Math.max(visibleMessages.length - 1, 0)
  const actualRevealedCount = Math.min(revealedCount, maxRevealedCount)

  const [placedNotesState, setPlacedNotes] = useState<Record<string, NotePosition>>({})
  const placedNotes = useMemo(() => {
    const allowed = new Set(visibleMessages.map((message) => message.id))
    return Object.fromEntries(
      Object.entries(placedNotesState)
        .filter(([id]) => allowed.has(id))
        .map(([id, position]) => [id, sanitizeNotePosition(position)])
    )
  }, [placedNotesState, visibleMessages])

  const [hasSettledLayout, setHasSettledLayout] = useState(false)
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>({})
  const zIndexCounterRef = useRef(100)
  const cardWidth = PREVIEW_CARD_SIZE
  const stackX = Math.max(size.width - cardWidth - 28, 0)
  const stackY = Math.max(size.height - PREVIEW_CARD_SIZE - 36, 10)
  const boardHref = getBoardHref(board.slug)
  const hasMeasured = size.width > 0 && size.height > 0

  useEffect(() => {
    if (hasMeasured && !hasSettledLayout) {
      const timer = setTimeout(() => setHasSettledLayout(true), 300)
      return () => clearTimeout(timer)
    }
  }, [hasMeasured, hasSettledLayout])

  function handleCommit(index: number, message: NoteMessage, nextPosition: NotePosition, distance: number) {

    if (index === actualRevealedCount) {
      if (distance >= PREVIEW_REVEAL_THRESHOLD) {
        setPlacedNotes((current) => ({ ...current, [message.id]: nextPosition }))
        setRevealedCount((current) => Math.min(current + 1, maxRevealedCount))
        return
      }

      setPlacedNotes((current) => {
        const next = { ...current }
        delete next[message.id]
        return next
      })
      return
    }

    setPlacedNotes((current) => ({ ...current, [message.id]: nextPosition }))
  }

  function bringToFront(id: string) {
    setCardZIndices((current) => ({ ...current, [id]: zIndexCounterRef.current++ }))
  }

  return (
    <div ref={containerRef} className={`note-board-preview transition-opacity duration-700 ease-out ${hasSettledLayout ? 'opacity-100' : 'opacity-0'}`}>
      {visibleMessages.length === 0 ? (
        <div className="note-board-preview__empty">
          <div className="note-board-preview__empty-content">
            <p>{board.emptyLabel}</p>
            <Link href={boardHref} className="note-board-preview__empty-link">
              {board.ctaLabel}
            </Link>
          </div>
        </div>
      ) : !hasMeasured ? null : (
        <>
          {visibleMessages.map((message, index) => {
            const placed = placedNotes[message.id]
            const stackDepth = Math.max(index - actualRevealedCount, 0)
            const position = placed
              ? {
                  x: clamp(placed.x, 0, Math.max(size.width - cardWidth, 0)),
                  y: clamp(placed.y, 0, Math.max(size.height - PREVIEW_CARD_SIZE, 0)),
                  rotation: placed.rotation,
                }
              : {
                  x: clamp(stackX - Math.min(stackDepth, 4) * 5, 0, Math.max(size.width - cardWidth, 0)),
                  y: clamp(stackY + Math.min(stackDepth, 4) * 6, 0, Math.max(size.height - PREVIEW_CARD_SIZE, 0)),
                  rotation: (seededUnit(message.id, 5) - 0.5) * 6,
                }
            const isDraggable = index <= actualRevealedCount

            return (
              <StickyNoteCard
                key={message.id}
                message={message}
                x={position.x}
                y={position.y}
                rotation={position.rotation}
                zIndex={cardZIndices[message.id] ?? (placed ? visibleMessages.length + index + 4 : visibleMessages.length - index + 2)}
                width={cardWidth}
                bounds={{ width: size.width, height: size.height }}
                colorIndex={getStickyColorIndex(message.id)}
                draggable={isDraggable}
                variant="preview"
                ctaHref={boardHref}
                ctaLabel={board.ctaLabel}
                animatePosition={hasSettledLayout}
                onLift={() => bringToFront(message.id)}
                onCommit={(nextPosition, metrics) => handleCommit(index, message, nextPosition, metrics.distance)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

// Mobile Views injected here
export function MobileStickyStack({
  messages,
  onDelete,
  canDelete,
  onEdit,
  canEdit,
  onToggleArchive,
}: {
  messages: NoteMessage[]
  onDelete: (id: string) => void
  canDelete: (message: NoteMessage) => boolean
  onEdit: (message: NoteMessage) => void
  canEdit: (message: NoteMessage) => boolean
  onToggleArchive: (message: NoteMessage) => void
}) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [revealedCount, setRevealedCount] = useState(0)
  const [placedNotesState, setPlacedNotes] = useState<Record<string, NotePosition>>({})
  const [isCollecting, setIsCollecting] = useState(false)
  const collectTimersRef = useRef<number[]>([])

  const cardWidth = Math.min(NOTE_CARD_WIDTH, Math.max(0, size.width - 32))
  const hasMeasured = size.width > 0 && size.height > 0

  const visibleMessages = useMemo(() => messages.map((message) => message), [messages])
  const placedNotes = useMemo(() => {
    const allowed = new Set(visibleMessages.map((message) => message.id))
    return Object.fromEntries(Object.entries(placedNotesState).filter(([id]) => allowed.has(id)))
  }, [placedNotesState, visibleMessages])
  const activeRevealedCount = Math.min(revealedCount, visibleMessages.length)
  const parkedCount = Object.keys(placedNotes).length

  useEffect(() => {
    return () => {
      collectTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  function parkMessageAt(index: number) {
    const message = visibleMessages[index]
    if (!message) return

    setPlacedNotes((current) => ({
      ...current,
      [message.id]: getMobileSideParkPosition(index % 2 === 0 ? 'right' : 'left', 18 + (index % 4) * 34, index, size, cardWidth),
    }))
  }

  function handleCommit(index: number, message: NoteMessage, nextPosition: NotePosition, distance: number) {
    if (isCollecting || index !== activeRevealedCount) return

    if (distance >= PREVIEW_REVEAL_THRESHOLD) {
      const releaseCenter = nextPosition.x + cardWidth / 2
      const parkSide = releaseCenter >= size.width / 2 ? 'right' : 'left'

      setPlacedNotes((current) => ({
        ...current,
        [message.id]: getMobileSideParkPosition(parkSide, nextPosition.y, index, size, cardWidth),
      }))
      setRevealedCount((current) => Math.min(current + 1, visibleMessages.length))
      return
    }

    setPlacedNotes((current) => {
      const next = { ...current }
      delete next[message.id]
      return next
    })
  }

  function handleNext() {
    if (isCollecting || activeRevealedCount >= visibleMessages.length) return
    parkMessageAt(activeRevealedCount)
    setRevealedCount((current) => Math.min(current + 1, visibleMessages.length))
  }

  function handlePrev() {
    if (isCollecting || activeRevealedCount <= 0) return

    const previousIndex = activeRevealedCount - 1
    const prevMessage = visibleMessages[previousIndex]
    if (!prevMessage) return

    setPlacedNotes((current) => {
      const next = { ...current }
      delete next[prevMessage.id]
      return next
    })
    setRevealedCount(previousIndex)
  }

  function handleCollect() {
    if (isCollecting || parkedCount === 0) return

    collectTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    collectTimersRef.current = []
    setIsCollecting(true)
    setRevealedCount(0)

    const idsInOriginalOrder = visibleMessages
      .map((message) => message.id)
      .filter((id) => id in placedNotes)

    idsInOriginalOrder.forEach((id, index) => {
      const timer = window.setTimeout(() => {
        setPlacedNotes((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      }, index * MOBILE_COLLECT_STAGGER_MS)

      collectTimersRef.current.push(timer)
    })

    const doneTimer = window.setTimeout(() => {
      setIsCollecting(false)
      collectTimersRef.current = []
    }, idsInOriginalOrder.length * MOBILE_COLLECT_STAGGER_MS + 520)

    collectTimersRef.current.push(doneTimer)
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-[24px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
        style={{ height: 380 }}
      >
        {!hasMeasured ? null : (
          <>
            {visibleMessages.map((message, index) => {
              const stackIndex = index - activeRevealedCount
              const placed = placedNotes[message.id]
              const position = placed
                ? placed
                : getMobileStackPosition(Math.max(stackIndex, 0), size, cardWidth, message.id)

              const isDraggable = !isCollecting && index === activeRevealedCount && activeRevealedCount < visibleMessages.length
              const isPastWithoutPlacement = index < activeRevealedCount && !placed
              const isHiddenBehindStack = !placed && stackIndex >= 5

              return (
                <div
                  key={message.id}
                  style={{
                    opacity: isPastWithoutPlacement || isHiddenBehindStack ? 0 : 1,
                    transition: 'opacity 300ms ease',
                    pointerEvents: isDraggable ? 'auto' : 'none',
                    zIndex: placed ? 30 + index : visibleMessages.length - index + 2,
                  }}
                  className="absolute left-0 top-0 w-0 h-0 overflow-visible"
                >
                  <StickyNoteCard
                    message={message}
                    x={position.x}
                    y={position.y}
                    rotation={position.rotation}
                    zIndex={placed ? 30 + index : visibleMessages.length - index + 2}
                    width={cardWidth}
                    bounds={{ width: size.width, height: size.height }}
                    colorIndex={getStickyColorIndex(message.id)}
                    draggable={isDraggable}
                    variant="board"
                    dragBoundsMode="mobile-stack"
                    showDelete={canDelete(message)}
                    showEdit={canEdit(message)}
                    showArchive={canEdit(message)}
                    onDelete={() => onDelete(message.id)}
                    onEdit={() => onEdit(message)}
                    onToggleArchive={() => onToggleArchive(message)}
                    animatePosition={true}
                    onLift={() => {}}
                    onCommit={(nextPosition, metrics) => handleCommit(index, message, nextPosition, metrics.distance)}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm font-mono text-muted-foreground">
          {visibleMessages.length === 0 ? 0 : Math.min(activeRevealedCount + 1, visibleMessages.length)} / {visibleMessages.length}
        </span>
        <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={activeRevealedCount === 0 || isCollecting}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground transition hover:bg-accent disabled:opacity-50"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={handleCollect}
          disabled={parkedCount === 0 || isCollecting}
          className="flex h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-card px-4 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
        >
          <RotateCcw size={14} />
          归位
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={activeRevealedCount >= visibleMessages.length || isCollecting}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground transition hover:bg-accent disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
        </div>
      </div>
    </div>
  )
}

export function MobileNoteList({
  messages,
  onDelete,
  canDelete,
  onEdit,
  canEdit,
  onToggleArchive,
}: {
  messages: NoteMessage[]
  onDelete: (id: string) => void
  canDelete: (message: NoteMessage) => boolean
  onEdit: (message: NoteMessage) => void
  canEdit: (message: NoteMessage) => boolean
  onToggleArchive: (message: NoteMessage) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id} className="rounded-[20px] border border-border/60 bg-background/55 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-sm">{message.author}</span>
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-xs text-muted-foreground">{formatCommentTimeLabel(message.created_at, message.updated_at)}</span>
              {canEdit(message) ? (
                <div className="flex items-center gap-2">
                  <button type="button" className="note-board-sticky__icon-button" aria-label="编辑便签" onClick={() => onEdit(message)}>
                    <PencilLine size={15} strokeWidth={1.9} />
                    <span className="note-board-sticky__icon-tooltip">编辑便签</span>
                  </button>
                  <button type="button" className="note-board-sticky__icon-button" aria-label={message.archived ? '取消归档' : '归档便签'} onClick={() => onToggleArchive(message)}>
                    {message.archived ? <ArchiveRestore size={15} strokeWidth={1.9} /> : <Archive size={15} strokeWidth={1.9} />}
                    <span className="note-board-sticky__icon-tooltip">{message.archived ? '取消归档' : '归档便签'}</span>
                  </button>
                </div>
              ) : null}
              {canDelete(message) && (
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-xs text-rose-600/70 hover:bg-rose-50 hover:text-rose-600 transition"
                  onClick={() => onDelete(message.id)}
                >
                  删除
                </button>
              )}
            </div>
          </div>
          <div className="text-sm leading-relaxed text-foreground/90">
            {renderNoteContent(message.content, 'board')}
          </div>
        </div>
      ))}
    </div>
  )
}

export function NoteBoardPage({ board, initialMessages }: NoteBoardPageProps) {
  const { identity, isAdmin, loading } = useAuth()
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [messages, setMessages] = useState(initialMessages)
  const [customPositions, setCustomPositions] = useState<Record<string, NotePosition>>({})
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialMessages.map((message, index) => [message.id, initialMessages.length - index + 1])),
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isScattered, setIsScattered] = useState(false)
  const [mobileView, setMobileView] = useState<'stack' | 'list'>('stack')
  const [nextOffset, setNextOffset] = useState(initialMessages.length)
  const [hasMore, setHasMore] = useState(initialMessages.length >= board.initialPageLimit)
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isUpdatingNote, setIsUpdatingNote] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false)
  const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null)
  const zIndexCounterRef = useRef(initialMessages.length + 2)
  const editorSectionRef = useRef<HTMLElement>(null)
  const toastTimerRef = useRef<number | null>(null)
  const pendingOptimisticIdsRef = useRef<Set<string>>(new Set())
  const canWrite = board.slug === 'guestbook' || isAdmin
  const { cardWidth, height, layouts } = useMemo(() => computeBoardLayout(messages, size.width), [messages, size.width])
  const hasMeasured = size.width > 0 && size.height > 0
  const editingMessage = useMemo(() => messages.find((message) => message.id === editingNoteId) ?? null, [messages, editingNoteId])

  useEffect(() => {
    if (!hasMeasured) return

    const frame = window.requestAnimationFrame(() => setIsScattered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [hasMeasured])

  useEffect(() => {
    setCardZIndices((current) => {
      const next: Record<string, number> = {}

      for (const message of messages) {
        next[message.id] = current[message.id] ?? zIndexCounterRef.current++
      }

      return next
    })
  }, [messages])

  useEffect(() => {
    if (!editingNoteId) return
    if (!messages.some((message) => message.id === editingNoteId)) {
      setEditingNoteId(null)
      setEditContent('')
    }
  }, [editingNoteId, messages])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  function showToast(message: string) {
    const nextNotice = { id: Date.now(), message }
    setToastNotice(nextNotice)

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastNotice((current) => current?.id === nextNotice.id ? null : current)
      toastTimerRef.current = null
    }, 2800)
  }

  function scrollToEditor() {
    window.requestAnimationFrame(() => {
      editorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function removeMessageFromSurface(id: string) {
    setMessages((current) => current.filter((message) => message.id !== id))
    setCustomPositions((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setCardZIndices((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setNextOffset((current) => Math.max(current - 1, 0))

    if (editingNoteId === id) {
      cancelEditingNote()
    }
  }

  function restoreMessageSnapshot(snapshot: OptimisticMessageSnapshot) {
    setMessages((current) => {
      const withoutTarget = current.filter((message) => message.id !== snapshot.message.id)
      const next = [...withoutTarget]
      next.splice(Math.min(snapshot.index, next.length), 0, snapshot.message)
      return next
    })

    if (snapshot.customPosition) {
      const customPosition = snapshot.customPosition
      setCustomPositions((current) => ({ ...current, [snapshot.message.id]: customPosition }))
    }

    if (typeof snapshot.zIndex === 'number') {
      const zIndex = snapshot.zIndex
      setCardZIndices((current) => ({ ...current, [snapshot.message.id]: zIndex }))
    }

    setNextOffset((current) => current + 1)
  }

  function bringCardToFront(id: string) {
    setCardZIndices((current) => ({ ...current, [id]: zIndexCounterRef.current++ }))
  }

  function resetBoardSurface(nextMessages: NoteMessage[], archived: boolean) {
    setMessages(nextMessages)
    setShowArchived(archived)
    setNextOffset(nextMessages.length)
    setHasMore(nextMessages.length >= board.initialPageLimit)
    setCustomPositions({})
    setCardZIndices(Object.fromEntries(nextMessages.map((message, index) => [message.id, nextMessages.length - index + 1])))
    cancelEditingNote()
  }

  function startEditingNote(message: NoteMessage) {
    setEditingNoteId(message.id)
    setEditContent(message.content)
    setError(null)
    scrollToEditor()
  }

  function cancelEditingNote() {
    setEditingNoteId(null)
    setEditContent('')
    setError(null)
  }

  async function fetchBoardMessages(archived: boolean, offset = 0, limit = board.initialPageLimit) {
    const response = await fetch(`/api/note-boards/${board.slug}?offset=${offset}&limit=${limit}&archived=${archived ? '1' : '0'}`)
    if (!response.ok) {
      throw new Error('便签加载失败，请稍后重试。')
    }

    return await response.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
  }

  async function handleSwitchArchiveView(archived: boolean) {
    if (archived === showArchived || isRefreshingBoard) return

    setIsRefreshingBoard(true)
    setError(null)

    try {
      const payload = await fetchBoardMessages(archived)
      startTransition(() => {
        resetBoardSurface(payload.messages, archived)
        setNextOffset(payload.nextOffset)
        setHasMore(payload.hasMore)
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '便签加载失败，请稍后重试。')
    } finally {
      setIsRefreshingBoard(false)
    }
  }

  async function handleToggleArchive(message: NoteMessage) {
    if (!identity || pendingOptimisticIdsRef.current.has(message.id)) return

    setError(null)
    pendingOptimisticIdsRef.current.add(message.id)
    const snapshot = buildOptimisticSnapshot(message.id, messages, customPositions, cardZIndices)
    removeMessageFromSurface(message.id)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, archived: !message.archived }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有归档权限。' : '归档状态更新失败，请稍后再试。')
      }
    } catch (archiveError) {
      if (snapshot) {
        restoreMessageSnapshot(snapshot)
      }
      showToast(archiveError instanceof Error ? archiveError.message : '归档状态更新失败，请稍后再试。')
    } finally {
      pendingOptimisticIdsRef.current.delete(message.id)
    }
  }

  async function saveEditingNote() {
    if (!editingMessage || !identity || isUpdatingNote) return

    const nextContent = editContent.trim()
    if (!nextContent) {
      setError('便签内容不能为空。')
      return
    }

    setIsUpdatingNote(true)
    setError(null)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}/${editingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, content: nextContent }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有编辑权限。' : '便签更新失败，请稍后再试。')
      }

      const updatedMessage = (await response.json()) as NoteMessage
      setMessages((current) => current.map((message) => message.id === updatedMessage.id ? updatedMessage : message))
      cancelEditingNote()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '便签更新失败，请稍后再试。')
    } finally {
      setIsUpdatingNote(false)
    }
  }

  async function submitDraft() {
    if (!draft.trim() || !identity || !canWrite || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: identity, content: draft.trim() }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有写入权限。' : '便签保存失败，请稍后再试。')
      }

      const message = (await response.json()) as NoteMessage
      setMessages((current) => [message, ...current])
      setNextOffset((current) => current + 1)
      setDraft('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '便签保存失败，请稍后再试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingMessage) {
      void saveEditingNote()
      return
    }
    void submitDraft()
  }

  async function handleDelete(id: string) {
    if (!identity || pendingOptimisticIdsRef.current.has(id)) return

    const snapshot = buildOptimisticSnapshot(id, messages, customPositions, cardZIndices)
    if (!snapshot) {
      return
    }

    setError(null)
    pendingOptimisticIdsRef.current.add(id)
    removeMessageFromSurface(id)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有删除权限。' : '删除失败，请稍后重试。')
      }
    } catch (deleteError) {
      restoreMessageSnapshot(snapshot)
      showToast(deleteError instanceof Error ? deleteError.message : '删除失败，请稍后重试。')
    } finally {
      pendingOptimisticIdsRef.current.delete(id)
    }
  }

  async function handleLoadMore() {
    const separator = `/api/note-boards/${board.slug}?offset=${nextOffset}&limit=${board.pageSize}&archived=${showArchived ? '1' : '0'}`
    const loadMoreResponse = await fetch(separator)
    if (!loadMoreResponse.ok) {
      setError('更多便签加载失败，请稍后重试。')
      return
    }

    const payload = await loadMoreResponse.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
    startTransition(() => {
      setMessages((current) => [...current, ...payload.messages])
      setNextOffset(payload.nextOffset)
      setHasMore(payload.hasMore)
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-border/60 bg-card/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{board.title}</p>
          </div>
          <p className="text-xs text-muted-foreground/80">当前已加载 {messages.length} 张便签</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border/70 bg-background/70 p-1 text-xs text-muted-foreground shadow-sm">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 transition ${!showArchived ? 'bg-foreground text-background' : 'hover:bg-accent'}`}
              onClick={() => handleSwitchArchiveView(false)}
              disabled={isRefreshingBoard}
            >
              当前便签
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 transition ${showArchived ? 'bg-foreground text-background' : 'hover:bg-accent'}`}
              onClick={() => handleSwitchArchiveView(true)}
              disabled={isRefreshingBoard}
            >
              已归档
            </button>
          </div>
          <div className="md:hidden flex justify-end">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
              onClick={() => setMobileView((v) => v === 'stack' ? 'list' : 'stack')}
            >
              {mobileView === 'stack' ? (
                <>
                  <LayoutList size={14} />
                  列表视图
                </>
              ) : (
                <>
                  <Layers size={14} />
                  卡片堆叠
                </>
              )}
            </button>
          </div>
        </div>

        <div className="md:hidden mb-12">
          {mobileView === 'stack' ? (
            <MobileStickyStack
              messages={messages}
              onDelete={handleDelete}
              onEdit={startEditingNote}
              onToggleArchive={handleToggleArchive}
              canDelete={(m) => getDeletePermission(board.slug, isAdmin, identity, m)}
              canEdit={(m) => getEditPermission(isAdmin, identity, m)}
            />
          ) : (
            <MobileNoteList
              messages={messages}
              onDelete={handleDelete}
              onEdit={startEditingNote}
              onToggleArchive={handleToggleArchive}
              canDelete={(m) => getDeletePermission(board.slug, isAdmin, identity, m)}
              canEdit={(m) => getEditPermission(isAdmin, identity, m)}
            />
          )}
        </div>

        <div className="hidden md:block">
          <div
            ref={containerRef}
            className="note-board-canvas relative overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:p-6"
            style={{ minHeight: Math.max(height, 420) }}
          >
            {messages.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-white/55 text-center text-sm text-muted-foreground">
                {showArchived ? '还没有已归档便签。' : board.emptyLabel}
              </div>
            ) : !hasMeasured ? null : (
              <div className="relative" style={{ minHeight: Math.max(height, 320) }}>
                {messages.map((message, index) => {
                  const layout = layouts[index]
                  const fallbackX = Math.max((size.width - cardWidth) / 2, 0) + Math.min(index, 4) * 2
                  const fallbackY = 22 + Math.min(index, 4) * 4
                  const custom = customPositions[message.id]
                  const position = custom ?? {
                    x: isScattered ? layout?.x ?? fallbackX : fallbackX,
                    y: isScattered ? layout?.y ?? fallbackY : fallbackY,
                    rotation: isScattered ? layout?.rotation ?? 0 : (index % 2 === 0 ? -2 : 2),
                  }

                  return (
                    <StickyNoteCard
                      key={message.id}
                      message={message}
                      x={position.x}
                      y={position.y}
                      rotation={position.rotation}
                      zIndex={cardZIndices[message.id] ?? layout?.zIndex ?? messages.length - index}
                      width={cardWidth}
                      bounds={{ width: size.width, height: Math.max(height, 420) }}
                      colorIndex={layout?.colorIndex ?? getStickyColorIndex(message.id)}
                      draggable={isScattered && editingNoteId !== message.id}
                      variant="board"
                      showDelete={getDeletePermission(board.slug, isAdmin, identity, message)}
                      showEdit={getEditPermission(isAdmin, identity, message)}
                      showArchive={getEditPermission(isAdmin, identity, message)}
                      onDelete={() => handleDelete(message.id)}
                      onEdit={() => startEditingNote(message)}
                      onToggleArchive={() => handleToggleArchive(message)}
                      onLift={() => bringCardToFront(message.id)}
                      onCommit={(nextPosition) => {
                        setCustomPositions((current) => ({ ...current, [message.id]: nextPosition }))
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="rounded-full border border-border/70 bg-card px-5 py-2 text-sm text-foreground transition hover:border-foreground/20 hover:bg-accent"
                onClick={handleLoadMore}
                disabled={isPending}
              >
                {isPending ? '正在展开更多便签…' : '加载更多便签'}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section ref={editorSectionRef} className="rounded-[28px] border border-border/60 bg-card/75 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] backdrop-blur-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {editingMessage ? '便签编辑区' : board.slug === 'guestbook' ? '留言区' : 'Memo 编辑区'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">当前身份：{loading ? '加载中…' : identity}</p>
        </div>

        {editingMessage ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-border/70 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
            正在编辑 {editingMessage.author} 的便签。保存后卡片时间会自动刷新。
          </div>
        ) : null}

        {canWrite ? (
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <NoteEditor
              value={editingMessage ? editContent : draft}
              onChange={editingMessage ? setEditContent : setDraft}
              placeholder={editingMessage ? '直接修改这张便签的原始文本，checklist 状态也在这里编辑。' : board.slug === 'guestbook' ? '写下想贴在主页上的留言，或直接插入 checklist。' : '写一条新的 Memo 便签，或直接插入 checklist。'}
              saveLabel={editingMessage ? '保存编辑' : '贴上便签'}
              isSaving={editingMessage ? isUpdatingNote : isSubmitting}
              onSave={() => {
                if (editingMessage) {
                  void saveEditingNote()
                  return
                }
                void submitDraft()
              }}
              onCancel={editingMessage ? cancelEditingNote : undefined}
              saveDisabled={!(editingMessage ? editContent : draft).trim()}
              maxLength={180}
              minHeightClassName="min-h-[140px]"
              shellClassName="overflow-hidden rounded-[24px] border border-border/70 bg-background/55"
              toolbarClassName="px-4 py-3 text-xs text-muted-foreground"
              autoFocus={!!editingMessage}
            />
          </form>
        ) : (
          <p className="mt-4 text-sm leading-7 text-muted-foreground">这个页面当前为只读模式，只有 admin 可以维护 Memo 内容。</p>
        )}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      {toastNotice ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex justify-center sm:justify-end">
          <div className="rounded-full bg-slate-950 px-4 py-2 text-sm text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
            {toastNotice.message}
          </div>
        </div>
      ) : null}
    </div>
  )
}
