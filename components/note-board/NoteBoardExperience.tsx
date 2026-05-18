'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlarmClock, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { NoteEditor } from '@/components/note-board/components/NoteEditor'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import { VisibilityPicker } from '@/components/note-board/components/VisibilityPicker'
import { StickyNoteCard } from '@/components/note-board/components/StickyNoteCard'
import {
  NoteBoardProvider,
  useNoteBoardActions,
  useNoteBoardBindings,
  useNoteBoardBoardState,
  useNoteBoardEditorState,
  useNoteBoardMeta,
  useNoteBoardToast,
} from '@/components/note-board/NoteBoardProvider'
import { MemoBoardShell, useMemoBoardFilters, type MemoBoardFilters } from '@/components/note-board/views/MemoBoardShell'
import { getStickyColorIndex, getStickyColorSeed } from '@/components/note-board/utils/board'
import { NoteColorThemeProvider } from '@/components/note-board/contexts/NoteColorThemeContext'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import {
  getNoteBoardViewModeCookieName,
  getNoteBoardViewModeStorageKey,
  type NoteBoardViewMode,
} from '@/lib/note-board-view-mode'
import type { NoteMessage } from '@/lib/note-boards'
export { StickyStackPreview } from '@/components/note-board/views/StickyStackPreview'

const MemosStreamView = dynamic(
  () => import('@/components/note-board/views/MemosStreamView').then((m) => m.MemosStreamView),
)

const MobileStickyStack = dynamic(
  () => import('@/components/note-board/views/MobileStickyStack').then((module) => module.MobileStickyStack),
  { ssr: false },
)

interface NoteBoardPageProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
  initialQuery?: string
  initialViewMode?: NoteBoardViewMode
}

function BoardStickyView({ onToggleViewMode, filters }: { onToggleViewMode: () => void; filters: MemoBoardFilters }) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const bindings = useNoteBoardBindings()
  const bindContainer = useCallback((node: HTMLDivElement | null) => {
    bindings.bindContainer(node)
  }, [bindings])
  const filteredNoteItems = filters.filterItemsByDate(state.noteItems)
  const filteredItemIds = useMemo(
    () => new Set(filteredNoteItems.map((item) => item.message.id)),
    [filteredNoteItems],
  )
  const summary = state.viewportReady && !state.isMobileViewport && !filters.isFilterMode
    ? `第 ${state.currentPage} 页 · ${state.visibleCount} 张`
    : `共 ${state.totalLoaded} 张`
  const emptyLabel = state.showArchived
    ? '还没有已归档便签。'
    : filters.isFilterMode
      ? '没有匹配的内容。'
      : meta.board.emptyLabel

  return (
    <MemoBoardShell
      title={meta.board.title}
      summary={summary}
      itemUnit="张"
      filteredCount={filteredNoteItems.length}
      toggleTarget="stream"
      onToggleViewMode={onToggleViewMode}
      filters={filters}
      searchPlaceholder={meta.board.slug === 'guestbook' ? '搜索留言内容…' : '搜索 Memo…'}
      allowPrioritySort={meta.board.slug === 'memo'}
    >
      {!state.viewportReady ? (
        <div
          className="rounded-[28px] p-5 sm:p-6"
          style={{ minHeight: 380 }}
        >
          <div className="h-full min-h-[280px] rounded-[24px] border border-dashed border-border/50 bg-background/15" />
        </div>
      ) : filteredNoteItems.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border/50 bg-background/15 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : state.isMobileViewport ? (
        <div className="mb-12">
          <MobileStickyStack items={filteredNoteItems} />
        </div>
      ) : (
        <div>
          <div
            ref={bindContainer}
            className="note-board-canvas relative overflow-hidden rounded-[28px] p-5 sm:p-6"
            style={{ minHeight: Math.max(meta.surface.height, 420) }}
          >
            {!meta.surface.hasMeasured ? null : (
              <div className="relative" style={{ minHeight: Math.max(meta.surface.height, 320) }}>
                {state.noteItems.map((item, index) => {
                  const { message, actions: cardActions, priorityControl, reactionControl, checklistControl, inlineEditor, isEditing, isOptimistic, isOptimisticEditing, isFresh } = item

                  if (filters.effectiveSelectedDate && !filteredItemIds.has(message.id)) {
                    return null
                  }

                  const layout = meta.surface.layouts[index]
                  const targetPosition = meta.surface.getTargetPosition(index)
                  const collapsedPosition = {
                    x: Math.max((meta.surface.size.width - meta.surface.cardWidth) / 2, 0) + Math.min(index, 4) * 2,
                    y: 22 + Math.min(index, 4) * 4,
                    rotation: index % 2 === 0 ? -2 : 2,
                  }
                  const custom = state.customPositions[message.id]
                  const position = custom ?? (meta.surface.isScattered ? targetPosition : collapsedPosition)

                  return (
                    <StickyNoteCard.Board
                      key={message.id}
                      message={message}
                      x={position.x}
                      y={position.y}
                      rotation={position.rotation}
                      zIndex={state.cardZIndices[message.id] ?? layout?.zIndex ?? state.messages.length - index}
                      width={meta.surface.cardWidth}
                      bounds={{ width: meta.surface.size.width, height: Math.max(meta.surface.height, 420) }}
                      colorIndex={layout?.colorIndex ?? getStickyColorIndex(getStickyColorSeed(message))}
                      draggable={meta.surface.isScattered && !isEditing}
                      actions={cardActions}
                      priorityControl={priorityControl}
                      reactionControl={reactionControl}
                      checklistControl={checklistControl}
                      inlineEditor={inlineEditor}
                      isOptimistic={isOptimistic}
                      isOptimisticEditing={isOptimisticEditing}
                      isFresh={isFresh}
                      onLift={() => actions.bringCardToFront(message.id)}
                      onCommit={(nextPosition) => actions.setCardPosition(message.id, nextPosition)}
                      onHeightChange={(nextHeight) => actions.handleCardHeightChange(message.id, nextHeight)}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {state.hasPreviousPage || state.hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-2 py-2 text-sm shadow-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={actions.handlePreviousPage}
                  disabled={!state.hasPreviousPage || state.isPending || state.isRefreshingBoard}
                >
                  <ChevronLeft size={16} />
                  上一页
                </button>
                <span className="min-w-[92px] text-center text-xs text-muted-foreground">
                  第 {state.currentPage} 页
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void actions.handleNextPage()}
                  disabled={!state.hasNextPage || state.isPending || state.isRefreshingBoard}
                >
                  下一页
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {state.viewportReady && state.isMobileViewport && state.hasMore ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className="rounded-full border border-border/70 bg-card px-5 py-2 text-sm text-foreground transition hover:border-foreground/20 hover:bg-accent"
            onClick={() => void actions.handleLoadMore()}
            disabled={state.isPending}
          >
            {state.isPending ? '正在展开更多便签…' : '加载更多便签'}
          </button>
        </div>
      ) : null}
    </MemoBoardShell>
  )
}

function DueDatePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const toLocalDatetimeValue = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v ? new Date(v).toISOString() : null)
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        title={value ? `截止：${new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '设置截止时间'}
        onClick={() => {
          setOpen((v) => !v)
          setTimeout(() => inputRef.current?.showPicker?.(), 50)
        }}
        className={[
          'inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors',
          value
            ? 'text-amber-500 hover:text-amber-600'
            : 'text-slate-400 hover:text-slate-600',
        ].join(' ')}
      >
        <AlarmClock size={13} strokeWidth={1.8} />
      </button>
      {value ? (
        <button
          type="button"
          title="清除截止时间"
          onClick={() => { onChange(null); setOpen(false) }}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-600"
        >
          <X size={10} strokeWidth={2} />
        </button>
      ) : null}
      {open && (
        <input
          ref={inputRef}
          type="datetime-local"
          value={toLocalDatetimeValue(value)}
          onChange={handleInputChange}
          onBlur={() => setOpen(false)}
          className="absolute bottom-full left-0 mb-1 rounded-lg border border-border/60 bg-card px-2 py-1 text-[11px] text-foreground shadow-lg outline-none focus:ring-1 focus:ring-primary/30"
          style={{ zIndex: 50 }}
        />
      )}
    </div>
  )
}

function NoteBoardEditorSection({ autoFocusOnEdit = false }: { autoFocusOnEdit?: boolean }) {
  const state = useNoteBoardEditorState()
  const boardState = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const bindings = useNoteBoardBindings()
  const bindEditorSection = useCallback((node: HTMLElement | null) => {
    bindings.bindEditorSection(node)
  }, [bindings])

  return (
    <section ref={bindEditorSection} className="rounded-[28px] border border-border/60 bg-card/95 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{state.editorSectionLabel}</p>
        </div>
        <p className="text-xs text-muted-foreground">当前身份：{state.loadingIdentity ? '加载中…' : state.viewerIdentity}</p>
      </div>

      {state.editorMode === 'edit' ? (
        <div className="mt-4 rounded-[24px] border border-dashed border-border/70 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
          正在编辑 {state.editingMessage?.author} 的便签。保存后卡片时间会自动刷新。
        </div>
      ) : null}

      {state.canWrite ? (
        <form className="mt-4 space-y-3" onSubmit={actions.handleSubmit}>
          <NoteEditor
            value={state.editorValue}
            onChange={actions.updateEditorValue}
            placeholder={state.editorPlaceholder}
            saveLabel={state.editorSaveLabel}
            isSaving={state.editorSaving}
            onSave={() => void actions.submitEditor()}
            onCancel={state.editorMode === 'edit' ? actions.cancelEditingNote : undefined}
            saveDisabled={!state.editorValue.trim()}
            maxLength={NOTE_MAX_LENGTH}
            minHeightClassName="min-h-[140px]"
            shellClassName="overflow-hidden rounded-[24px] border border-border/70 bg-background/55"
            toolbarClassName="px-4 py-3 text-xs text-muted-foreground"
            toolbarLeadingAddon={
              <>
                {state.priorityEnabled ? (
                  <PriorityPicker.Dot
                    value={state.editorPriority}
                    onChange={actions.updateEditorPriority}
                    buttonClassName="h-8 w-8"
                    dotClassName="h-2.5 w-2.5"
                    menuAlign="start"
                    menuDirection="up"
                  />
                ) : null}
                {state.isAdmin ? (
                  <VisibilityPicker
                    value={state.editorVisibility}
                    onChange={actions.updateEditorVisibility}
                  />
                ) : null}
                {state.isAdmin ? (
                  <DueDatePicker
                    value={state.editorDueAt}
                    onChange={actions.updateEditorDueAt}
                  />
                ) : null}
              </>
            }
            autoFocus={state.editorMode === 'edit' && (boardState.isMobileViewport || autoFocusOnEdit)}
          />
        </form>
      ) : (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">这里先开放浏览，Memo 暂时由 admin 维护与更新。</p>
      )}

      {state.error ? <p className="mt-3 text-sm text-rose-600">{state.error}</p> : null}
    </section>
  )
}

function NoteBoardToast() {
  const toastNotice = useNoteBoardToast()

  if (!toastNotice) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex justify-center sm:justify-end">
      <div className="rounded-full bg-slate-950 px-4 py-2 text-sm text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
        {toastNotice.message}
      </div>
    </div>
  )
}

function NoteBoardExperience({ initialViewMode = 'sticky' }: { initialViewMode?: NoteBoardViewMode }) {
  const meta = useNoteBoardMeta()
  const state = useNoteBoardBoardState()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const viewModeStorageKey = getNoteBoardViewModeStorageKey(meta.board.slug)
  const viewModeCookieName = getNoteBoardViewModeCookieName(meta.board.slug)
  const filters = useMemoBoardFilters(state.allNoteItems, selectedDate, setSelectedDate)

  const [viewMode, setViewMode] = useState<NoteBoardViewMode>(initialViewMode)

  useEffect(() => {
    window.localStorage.setItem(viewModeStorageKey, viewMode)
    document.cookie = `${viewModeCookieName}=${viewMode}; path=/; max-age=31536000; SameSite=Lax`
  }, [viewMode, viewModeCookieName, viewModeStorageKey])

  const toggleViewMode = useCallback(
    () => setViewMode((v) => (v === 'sticky' ? 'stream' : 'sticky')),
    [],
  )

  return (
    <div className="space-y-6">
      {viewMode === 'stream'
        ? <MemosStreamView onToggleViewMode={toggleViewMode} filters={filters} />
        : <BoardStickyView onToggleViewMode={toggleViewMode} filters={filters} />}
      <NoteBoardEditorSection autoFocusOnEdit={viewMode === 'stream'} />
      <NoteBoardToast />
    </div>
  )
}

export function NoteBoardPage({ board, initialMessages, initialQuery = '', initialViewMode = 'sticky' }: NoteBoardPageProps) {
  return (
    <NoteColorThemeProvider>
      <NoteBoardProvider board={board} initialMessages={initialMessages} initialQuery={initialQuery}>
        <NoteBoardExperience initialViewMode={initialViewMode} />
      </NoteBoardProvider>
    </NoteColorThemeProvider>
  )
}
