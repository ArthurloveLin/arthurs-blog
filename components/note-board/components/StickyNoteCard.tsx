'use client'

import { AlarmClock, Archive, ArchiveRestore, ArrowRight, Check, ChevronsDown, Copy, FileDown, FileImage, FileText, PencilLine, Share2, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import EmojiReactionSummary from '@/components/emoji/EmojiReactionSummary'
import ReactionToggleBar from '@/components/ReactionToggleBar'
import { NoteActionButton } from '@/components/note-board/components/NoteActionButton'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import { useStickyNoteDrag } from '@/components/note-board/hooks/useStickyNoteDrag'
import { downloadNote, exportNoteAsImage } from '@/components/note-board/utils/noteExport'
import { hasInlineDueTags } from '@/components/note-board/utils/editor'
import { NoteInlineEditor } from '@/components/note-board/components/NoteEditor'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import styles from '@/components/note-board/styles/StickyNote.module.css'
import type {
  NotePosition,
  Size,
  StickyNoteCardActions,
  StickyNoteCardInlineEditor,
  StickyNoteCardChecklistControl,
  StickyNoteCardLinkAction,
  StickyNoteCardPriorityControl,
  StickyNoteCardReactionControl,
} from '@/components/note-board/types'
import {
  MOBILE_SIDE_PEEK_RATIO,
  PREVIEW_CARD_SIZE,
  PREVIEW_REVEAL_THRESHOLD,
} from '@/components/note-board/utils/board'
import { useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import { formatCommentTimeLabel, formatStableDate } from '@/lib/date-format'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import { NOTE_PRIORITY_META } from '@/lib/note-priority'
import type { MemoHabitCurrentState } from '@/lib/memo-habits'
import type { NoteMessage } from '@/lib/note-boards'

interface StickyNoteCardSharedProps {
  message: NoteMessage
  x: number
  y: number
  rotation: number
  zIndex: number
  width: number
  bounds: Size
  colorIndex: number
  draggable: boolean
  onLift?: () => void
  onCommit?: (nextPosition: NotePosition, metrics: { distance: number }) => void
}

interface StickyNoteBoardCardProps extends StickyNoteCardSharedProps {
  actions?: StickyNoteCardActions
  priorityControl?: StickyNoteCardPriorityControl
  reactionControl: StickyNoteCardReactionControl
  checklistControl?: StickyNoteCardChecklistControl
  inlineEditor?: StickyNoteCardInlineEditor
  onHeightChange?: (height: number) => void
  surface?: 'desktop' | 'mobile-stack'
  isOptimistic?: boolean
  isOptimisticEditing?: boolean
  isFresh?: boolean
  habitStates?: Record<string, MemoHabitCurrentState>
  onOpenHabitDetail?: (noteId: string, itemKey: string) => void
  onCompleteHabitItem?: (noteId: string, itemKey: string) => void
}

interface StickyNotePreviewCardProps extends StickyNoteCardSharedProps {
  cta?: StickyNoteCardLinkAction
  animatePosition?: boolean
}

interface StickyNoteCardFrameProps extends StickyNoteCardSharedProps {
  variant: 'preview' | 'board'
  actions?: StickyNoteCardActions
  priorityControl?: StickyNoteCardPriorityControl
  reactionControl?: StickyNoteCardReactionControl
  checklistControl?: StickyNoteCardChecklistControl
  inlineEditor?: StickyNoteCardInlineEditor
  onHeightChange?: (height: number) => void
  animatePosition: boolean
  dragBoundsMode: 'contained' | 'mobile-stack'
  isOptimistic?: boolean
  isOptimisticEditing?: boolean
  isFresh?: boolean
  habitStates?: Record<string, MemoHabitCurrentState>
  onOpenHabitDetail?: (noteId: string, itemKey: string) => void
  onCompleteHabitItem?: (noteId: string, itemKey: string) => void
}

function StickyDueBadge({ dueAt }: { dueAt: string }) {
  const [now] = useState(Date.now)
  const diff = Date.parse(dueAt) - now
  const abs = Math.abs(diff)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor(abs / 3600000)
  const mins = Math.floor(abs / 60000)
  const isOverdue = diff < 0
  const label = isOverdue
    ? `超期 ${days > 0 ? `${days}d` : hours > 0 ? `${hours}h` : `${mins || 1}m`}`
    : `${days > 0 ? `${days}d` : hours > 0 ? `${hours}h` : `${mins || 1}m`}后截止`

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={[
        'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        isOverdue
          ? 'bg-red-100/80 text-red-600'
          : diff < 86400000
            ? 'bg-amber-100/80 text-amber-600'
            : 'bg-black/5 text-slate-500',
      ].join(' ')}>
      <AlarmClock size={9} strokeWidth={2} />
      {label}
    </div>
  )
}

const RESTING_NOTE_SHADOW = '-1px 10px 5px -4px rgba(0, 0, 0, 0.2), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)'
const LIFTED_NOTE_SHADOW = '-1px 14px 40px -4px rgba(0, 0, 0, 0.12), inset 0 18px 24px -12px rgba(0, 0, 0, 0.22)'
const RELEASE_NOTE_SHADOW = '-1px 10px 5px -4px rgba(0, 0, 0, 0.2), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)'


function StickyNoteCardFrame({
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
  actions,
  priorityControl,
  reactionControl,
  checklistControl,
  inlineEditor,
  onLift,
  onCommit,
  onHeightChange,
  animatePosition,
  dragBoundsMode,
  isOptimistic = false,
  isFresh = false,
  habitStates,
  onOpenHabitDetail,
  onCompleteHabitItem,
}: StickyNoteCardFrameProps) {
  const articleRef = useRef<HTMLElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const measuredHeightRef = useRef(0)
  const paperHeightRef = useRef(0)
  const isInlineEditingRef = useRef(Boolean(inlineEditor))
  const [confirmingAction, setConfirmingAction] = useState<'archive' | 'delete' | null>(null)
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isPreview = variant === 'preview'
  const isInlineEditing = Boolean(inlineEditor)
  const { theme } = useNoteColorTheme()
  const chrome = theme.chrome
  const noteSlot = theme.slots[colorIndex % theme.slots.length] ?? theme.slots[0]
  const noteColor = noteSlot.bg
  const noteDepth = noteSlot.bg2
  const noteInk = noteSlot.ink
  // Export menu / confirm-action chrome follows the active note palette (incl. the
  // opt-in `dark` theme) instead of hardcoded slate/white, which inverted to
  // light-on-dark under the dark note palette. Hover is driven via local CSS vars
  // so the arbitrary-property classes stay declarative (matches MemoBoardShell's
  // --memo-* convention, but scoped locally to avoid relying on ancestor cascade).
  const menuChromeVars = {
    '--note-menu-text': chrome.cardText,
    '--note-menu-hover-surface': chrome.controlHoverSurface,
    '--note-menu-hover-text': chrome.controlHoverText,
    '--note-menu-active-surface': chrome.controlActiveSurface,
  } as CSSProperties
  // Collapses automatically while inline-editing (derived — no separate reset effect needed)
  const showExpanded = isExpanded && !isInlineEditing

  useEffect(() => {
    isInlineEditingRef.current = isInlineEditing
  }, [isInlineEditing])

  // Detect content overflow — setState is in the ResizeObserver callback, not the effect body
  useEffect(() => {
    if (showExpanded || isInlineEditing || isPreview) return
    const el = contentRef.current
    if (!el) return
    const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [showExpanded, isInlineEditing, isPreview])

  // Collapse on pointer-down outside the card — setState is in the event handler, not the effect body
  useEffect(() => {
    if (!showExpanded) return
    const handler = (e: PointerEvent) => {
      if (!articleRef.current?.contains(e.target as Node)) setIsExpanded(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showExpanded])

  // Auto-collapse expanded content and close menus when a drag lifts.
  // Done in the lift handler (not an effect body) per the note-board convention
  // — avoids react-hooks/set-state-in-effect cascading renders.
  const handleLift = useCallback(() => {
    setIsExpanded(false)
    setShowExportMenu(false)
    setConfirmingAction(null)
    onLift?.()
  }, [onLift])

  const { isDragging, activePosition, dragHandlers } = useStickyNoteDrag({
    visualRef,
    paperRef,
    x,
    y,
    rotation,
    draggable,
    animatePosition,
    shadows: {
      resting: RESTING_NOTE_SHADOW,
      lifted: LIFTED_NOTE_SHADOW,
      releaseEarly: RELEASE_NOTE_SHADOW,
      releaseSettle: RELEASE_NOTE_SHADOW,
    },
    computeDragBounds: () => {
      if (dragBoundsMode === 'mobile-stack') {
        const minX = -width * 0.72
        const minY = -24
        return {
          minX,
          maxX: Math.max(bounds.width - width * MOBILE_SIDE_PEEK_RATIO, minX),
          minY,
          maxY: Math.max(bounds.height - 148, minY),
        }
      }

      const minX = 0
      const minY = 0
      return {
        minX,
        maxX: Math.max(bounds.width - width, minX),
        minY,
        maxY: Math.max(bounds.height - (isPreview ? PREVIEW_CARD_SIZE : 200), minY),
      }
    },
    shouldReleaseOnCommit: (distance) =>
      dragBoundsMode !== 'mobile-stack' || distance < PREVIEW_REVEAL_THRESHOLD,
    onLift: handleLift,
    onCommit,
  })

  useEffect(() => {
    if (!isInlineEditing && paperRef.current) {
      paperHeightRef.current = Math.ceil(paperRef.current.offsetHeight)
    }
  }, [isInlineEditing, message.content, message.updated_at, message.upvotes, message.downvotes])

  useEffect(() => {
    if (!confirmingAction) return

    const timeout = window.setTimeout(() => setConfirmingAction(null), 3600)
    return () => window.clearTimeout(timeout)
  }, [confirmingAction])

  useEffect(() => {
    if (!showExportMenu) return
    const timeout = window.setTimeout(() => setShowExportMenu(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [showExportMenu])

  useEffect(() => {
    if (!onHeightChange || typeof ResizeObserver === 'undefined' || isInlineEditing) return

    const element = articleRef.current
    if (!element) return

    const emitHeight = () => {
      if (isInlineEditingRef.current) {
        return
      }

      const nextHeight = Math.ceil(element.offsetHeight)

      if (nextHeight <= 0 || nextHeight === measuredHeightRef.current) {
        return
      }

      measuredHeightRef.current = nextHeight
      onHeightChange(nextHeight)

      if (!isInlineEditing && paperRef.current) {
        paperHeightRef.current = Math.ceil(paperRef.current.offsetHeight)
      }
    }

    emitHeight()

    const observer = new ResizeObserver(() => emitHeight())
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [isInlineEditing, onHeightChange])

  const showConfirmActions = !isPreview && confirmingAction && ((confirmingAction === 'archive' && actions?.archive) || (confirmingAction === 'delete' && actions?.delete))

  return (
    <article
      ref={articleRef}
      className={[
        'absolute touch-none select-none',
        styles.sticky,
        styles.paperFrame,
        isPreview ? styles.previewCard : '',
        isDragging ? styles.dragging : '',
        (isOptimistic || isFresh) ? 'animate-in fade-in slide-in-from-bottom-3 duration-300' : '',
      ].filter(Boolean).join(' ')}
      style={{
        width,
        zIndex: isDragging ? 999 : zIndex,
        transform: `translate3d(${activePosition.x}px, ${activePosition.y}px, 0)`,
        transition: isDragging
          ? 'none'
          : animatePosition
            ? 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms ease'
            : 'none',
        cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      {...dragHandlers}
    >
      <div ref={visualRef} className={styles.noteSurface}>
        {priorityControl && !isPreview ? (
          priorityControl.onChange ? (
            <PriorityPicker.Tape
              value={priorityControl.value}
              onChange={priorityControl.onChange}
              disabled={priorityControl.disabled}
              rootClassName={styles.tapeAnchor}
              buttonClassName={[styles.tapeButton, isDragging ? styles.tapeButtonDragging : ''].filter(Boolean).join(' ')}
              menuAlign="start"
              menuDirection="down"
            />
          ) : (
            <div
              className={[styles.tape, isDragging ? styles.tapeDragging : ''].join(' ')}
              style={{ backgroundColor: NOTE_PRIORITY_META[priorityControl.value].color }}
            />
          )
        ) : null}
        <div
          ref={paperRef}
          className={[styles.paper, isPreview ? styles.previewPaper : styles.boardPaper].join(' ')}
          style={{
            background: `linear-gradient(180deg, ${noteColor} 0%, ${noteColor} 72%, ${noteDepth} 100%)`,
            color: noteInk,
            minHeight: isInlineEditing && inlineEditor?.surfaceMinHeight
              ? `${inlineEditor.surfaceMinHeight}px`
              : undefined,
          }}
        >
          <div className={styles.meta}>
            <div className={styles.metaCopy}>
              <p className={styles.author}>{message.author}</p>
              <p className={[styles.time, styles.metaTime, isPreview ? styles.timePreview : styles.timeBoard].join(' ')}>
                {formatCommentTimeLabel(message.created_at, message.updated_at)}
              </p>
            </div>
            <div className={[styles.actions, (confirmingAction !== null || isInlineEditing || showExportMenu) ? styles.actionsVisible : ''].filter(Boolean).join(' ')}>
              {actions?.cta ? (
                <Link
                  href={actions.cta.href}
                  aria-label={actions.cta.label}
                  className={styles.iconLink}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <ArrowRight size={18} strokeWidth={1.85} />
                  <span className={styles.iconTooltip}>{actions.cta.label}</span>
                </Link>
              ) : null}

              {actions?.archive ? (
                <NoteActionButton
                  label={confirmingAction === 'archive' ? '确认归档便签' : (actions.archive.archived ? '取消归档' : '归档便签')}
                  onClick={() => setConfirmingAction((current) => current === 'archive' ? null : 'archive')}
                >
                  {actions.archive.archived ? <ArchiveRestore size={16} strokeWidth={1.9} /> : <Archive size={16} strokeWidth={1.9} />}
                </NoteActionButton>
              ) : null}
              {actions?.edit && !isPreview && !isInlineEditing ? (
                <NoteActionButton label="编辑便签" onClick={actions.edit.onClick}>
                  <PencilLine size={16} strokeWidth={1.9} />
                </NoteActionButton>
              ) : null}
              {isInlineEditing && inlineEditor?.onCancel ? (
                <NoteActionButton label="取消编辑" onClick={inlineEditor.onCancel}>
                  <X size={16} strokeWidth={1.9} />
                </NoteActionButton>
              ) : null}
              {!isInlineEditing ? (
                <NoteActionButton
                  label="分享/导出"
                  onClick={() => setShowExportMenu((v) => !v)}
                >
                  <Share2 size={15} strokeWidth={1.85} />
                </NoteActionButton>
              ) : null}
              {actions?.delete && !isInlineEditing ? (
                <NoteActionButton
                  label={confirmingAction === 'delete' ? '确认删除便签' : '删除便签'}
                  onClick={() => setConfirmingAction((current) => current === 'delete' ? null : 'delete')}
                >
                  <Trash2 size={16} strokeWidth={1.85} />
                </NoteActionButton>
              ) : null}
            </div>
          </div>
          {showConfirmActions ? (
            <div className="mb-2 flex items-center justify-end gap-2" onPointerDown={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-widest transition [border-color:var(--memo-control-border,rgba(0,0,0,0.1))] [background:var(--note-menu-hover-surface)] text-[color:var(--note-menu-text)] hover:text-[color:var(--note-menu-hover-text)]"
                style={menuChromeVars}
                onClick={() => setConfirmingAction(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-[10px] font-bold tracking-widest transition hover:opacity-90"
                style={{ background: chrome.primarySurface, color: chrome.primaryText }}
                onClick={() => {
                  if (confirmingAction === 'archive') {
                    actions?.archive?.onToggle()
                  }

                  if (confirmingAction === 'delete') {
                    actions?.delete?.onClick()
                  }

                  setConfirmingAction(null)
                }}
              >
                {confirmingAction === 'archive' ? '确认归档' : '确认删除'}
              </button>
            </div>
          ) : null}
          {showExportMenu ? (
            <div
              className="absolute right-0 top-10 z-20 min-w-[152px] overflow-hidden rounded-xl border py-1 shadow-lg backdrop-blur-md"
              style={{ ...menuChromeVars, background: chrome.panelSurface, borderColor: chrome.panelBorder, boxShadow: chrome.panelShadow }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] transition text-[color:var(--note-menu-text)] hover:[background:var(--note-menu-hover-surface)] hover:text-[color:var(--note-menu-hover-text)] active:[background:var(--note-menu-active-surface)]"
                onClick={() => {
                  void navigator.clipboard.writeText(message.content).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                    setShowExportMenu(false)
                  })
                }}
              >
                {copied ? <Check size={13} strokeWidth={2} className="text-green-600 shrink-0" /> : <Copy size={13} strokeWidth={1.85} className="shrink-0" />}
                复制文本
              </button>
              <div className="mx-3 my-0.5 border-t" style={{ borderColor: chrome.panelBorder }} />
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] transition text-[color:var(--note-menu-text)] hover:[background:var(--note-menu-hover-surface)] hover:text-[color:var(--note-menu-hover-text)] active:[background:var(--note-menu-active-surface)]"
                onClick={() => { downloadNote(message.content, 'txt'); setShowExportMenu(false) }}
              >
                <FileText size={13} strokeWidth={1.85} className="shrink-0" />
                导出纯文本
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] transition text-[color:var(--note-menu-text)] hover:[background:var(--note-menu-hover-surface)] hover:text-[color:var(--note-menu-hover-text)] active:[background:var(--note-menu-active-surface)]"
                onClick={() => { downloadNote(message.content, 'md'); setShowExportMenu(false) }}
              >
                <FileDown size={13} strokeWidth={1.85} className="shrink-0" />
                导出 Markdown
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] transition text-[color:var(--note-menu-text)] hover:[background:var(--note-menu-hover-surface)] hover:text-[color:var(--note-menu-hover-text)] active:[background:var(--note-menu-active-surface)]"
                onClick={() => { exportNoteAsImage(message.content, message.author, message.created_at); setShowExportMenu(false) }}
              >
                <FileImage size={13} strokeWidth={1.85} className="shrink-0" />
                导出为图片
              </button>
            </div>
          ) : null}
          {inlineEditor ? (
            <div className="w-full min-w-0 max-w-full" onPointerDown={(event) => event.stopPropagation()}>
              <NoteInlineEditor
                value={inlineEditor.value}
                onChange={inlineEditor.onChange}
                isSaving={inlineEditor.isSaving}
                onSave={inlineEditor.onSave}
                onCancel={inlineEditor.onCancel}
                saveDisabled={!inlineEditor.value.trim()}
                maxLength={NOTE_MAX_LENGTH}
              />
            </div>
          ) : isPreview ? (
            <NoteContent
              content={message.content}
              variant={variant}
              onToggleChecklistItem={checklistControl?.onToggle}
              checklistPending={checklistControl?.pending}
              notifiedDues={message.notified_dues}
              habitStates={habitStates}
              onOpenHabitDetail={onOpenHabitDetail ? (itemKey) => onOpenHabitDetail(message.id, itemKey) : undefined}
              onCompleteHabitItem={onCompleteHabitItem ? (itemKey) => onCompleteHabitItem(message.id, itemKey) : undefined}
            />
          ) : (
            <>
              <div
                ref={contentRef}
                className="relative"
                style={!showExpanded ? {
                  maxHeight: 260,
                  overflow: 'hidden',
                  ...(isOverflowing ? {
                    maskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 45px), transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 45px), transparent 100%)',
                  } : {}),
                } : undefined}
              >
                <NoteContent
                  content={message.content}
                  variant={variant}
                  onToggleChecklistItem={checklistControl?.onToggle}
                  checklistPending={checklistControl?.pending}
                  notifiedDues={message.notified_dues}
                  habitStates={habitStates}
                  onOpenHabitDetail={onOpenHabitDetail ? (itemKey) => onOpenHabitDetail(message.id, itemKey) : undefined}
                  onCompleteHabitItem={onCompleteHabitItem ? (itemKey) => onCompleteHabitItem(message.id, itemKey) : undefined}
                />
              </div>
              {isOverflowing && !showExpanded ? (
                <button
                  type="button"
                  aria-label="展开查看全部"
                  className="mx-auto mt-2 flex items-center justify-center opacity-45 transition-all duration-200 hover:opacity-85 active:scale-95"
                  style={{ color: noteInk }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(true) }}
                >
                  <ChevronsDown size={18} strokeWidth={1.5} />
                </button>
              ) : null}
            </>
          )}
          {!isPreview && message.due_at && !hasInlineDueTags(message.content) ? (
            <StickyDueBadge dueAt={message.due_at} />
          ) : null}
          {!isPreview && reactionControl ? (
            <div className="mt-auto pt-1" onPointerDown={(event) => event.stopPropagation()}>
              <EmojiReactionSummary
                entries={reactionControl.emojiReactions}
                onSelect={reactionControl.onEmojiReact}
                variant="bare"
                className="mb-2 gap-x-2 gap-y-1"
              />
              <div className="flex items-center justify-between gap-1">
                <ReactionToggleBar
                  compact
                  variant="bare"
                  upvotes={reactionControl.upvotes}
                  downvotes={reactionControl.downvotes}
                  viewerReaction={reactionControl.viewerReaction}
                  pending={reactionControl.pending}
                  emojiPending={reactionControl.emojiPending}
                  onReact={reactionControl.onReact}
                  onEmojiReact={reactionControl.onEmojiReact}
                />
                <span className="shrink-0 text-[9px] leading-none opacity-40">
                  {formatStableDate(message.created_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function StickyNoteBoardCard({
  actions,
  priorityControl,
  reactionControl,
  checklistControl,
  inlineEditor,
  onHeightChange,
  surface = 'desktop',
  isOptimistic,
  isOptimisticEditing,
  isFresh,
  ...props
}: StickyNoteBoardCardProps) {
  return (
    <StickyNoteCardFrame
      {...props}
      variant="board"
      actions={actions}
      priorityControl={priorityControl}
      reactionControl={reactionControl}
      checklistControl={checklistControl}
      inlineEditor={inlineEditor}
      onHeightChange={onHeightChange}
      animatePosition
      dragBoundsMode={surface === 'mobile-stack' ? 'mobile-stack' : 'contained'}
      isOptimistic={isOptimistic}
      isOptimisticEditing={isOptimisticEditing}
      isFresh={isFresh}
    />
  )
}

export function StickyNotePreviewCard({ cta, animatePosition = true, ...props }: StickyNotePreviewCardProps) {
  return (
    <StickyNoteCardFrame
      {...props}
      variant="preview"
      actions={cta ? { cta } : undefined}
      animatePosition={animatePosition}
      dragBoundsMode="contained"
    />
  )
}

export const StickyNoteCard = {
  Board: StickyNoteBoardCard,
  Preview: StickyNotePreviewCard,
}
