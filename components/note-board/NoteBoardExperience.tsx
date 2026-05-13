'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Layers, LayoutList, Search, X } from 'lucide-react'
import { NoteEditor } from '@/components/note-board/components/NoteEditor'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
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
import { SidebarCalendar, SidebarTagCloud, getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
import { getStickyColorIndex, getStickyColorSeed } from '@/components/note-board/utils/board'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'
export { StickyStackPreview } from '@/components/note-board/views/StickyStackPreview'

const MemosStreamView = dynamic(
  () => import('@/components/note-board/views/MemosStreamView').then((m) => m.MemosStreamView),
  { ssr: false },
)

const MobileNoteList = dynamic(
  () => import('@/components/note-board/views/MobileNoteList').then((module) => module.MobileNoteList),
  { ssr: false },
)

const MobileStickyStack = dynamic(
  () => import('@/components/note-board/views/MobileStickyStack').then((module) => module.MobileStickyStack),
  { ssr: false },
)

interface NoteBoardPageProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
  initialQuery?: string
}

function SearchBar() {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [localQuery, setLocalQuery] = useState(() => state.searchQuery)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isExpanded = isFocused || !!localQuery

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    actions.handleSearch(localQuery.trim())
  }

  function handleClear() {
    setLocalQuery('')
    actions.handleSearch('')
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex h-8 items-center overflow-hidden rounded-full border border-border/70 bg-background/70 shadow-sm"
      style={{
        width: isExpanded ? '200px' : '32px',
        transition: 'width 600ms cubic-bezier(0,1.22,0.66,1.39)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="搜索便签内容…"
        className="absolute left-0 h-full w-full bg-transparent pl-3 pr-8 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60"
        style={{
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
        autoComplete="off"
        tabIndex={isExpanded ? 0 : -1}
      />
      <button
        type="button"
        onClick={localQuery ? handleClear : () => inputRef.current?.focus()}
        className="absolute right-0 flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground"
        aria-label={localQuery ? '清除搜索' : '搜索'}
      >
        {localQuery ? <X size={12} /> : <Search size={13} />}
      </button>
    </form>
  )
}

function SortDropdown() {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const currentLabel = state.showArchived ? '归档' : state.sortMode === 'priority' ? '优先级' : '日期'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <ArrowUpDown size={12} />
        {currentLabel}
        <ChevronDown size={11} className={`transition-transform${open ? ' rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[108px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg">
          <button
            type="button"
            onClick={() => { void actions.handleSortModeChange('time'); void actions.handleSwitchArchiveView(false); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${!state.showArchived && state.sortMode === 'time' ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {!state.showArchived && state.sortMode === 'time' ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
            按日期
          </button>
          <button
            type="button"
            onClick={() => { void actions.handleSortModeChange('priority'); void actions.handleSwitchArchiveView(false); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${!state.showArchived && state.sortMode === 'priority' ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {!state.showArchived && state.sortMode === 'priority' ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
            按优先级
          </button>
          <div className="mx-3 border-t border-border/40" />
          <button
            type="button"
            onClick={() => { void actions.handleSwitchArchiveView(!state.showArchived); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${state.showArchived ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {state.showArchived ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
            已归档
          </button>
        </div>
      ) : null}
    </div>
  )
}

interface NoteBoardControlsProps {
  viewMode?: 'sticky' | 'stream'
  onToggleViewMode?: () => void
}

function NoteBoardControls({ viewMode, onToggleViewMode }: NoteBoardControlsProps) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const bindings = useNoteBoardBindings()
  const priorityEnabled = meta.board.slug === 'memo'
  const isSearchMode = Boolean(state.searchQuery || state.activeTag)
  const bindContainer = useCallback((node: HTMLDivElement | null) => {
    bindings.bindContainer(node)
  }, [bindings])

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false)
  const effectiveSelectedDate = isSearchMode ? null : selectedDate
  const isFilterMode = isSearchMode || !!effectiveSelectedDate

  const memoDateCounts = useMemo(() => {
    if (!priorityEnabled) return new Map<string, number>()
    const counts = new Map<string, number>()
    for (const item of state.allNoteItems) {
      const ts = item.message.updated_at ?? item.message.created_at
      const { year, month, day } = getShanghaDateParts(ts)
      const key = toDateKey(year, month, day)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [priorityEnabled, state.allNoteItems])

  const dateFilteredCount = useMemo(() => {
    if (!effectiveSelectedDate) return state.visibleCount
    return state.noteItems.filter((item) => {
      const ts = item.message.updated_at ?? item.message.created_at
      const { year, month, day } = getShanghaDateParts(ts)
      return toDateKey(year, month, day) === effectiveSelectedDate
    }).length
  }, [effectiveSelectedDate, state.noteItems, state.visibleCount])

  return (
    <section className="rounded-[32px] border border-border/60 bg-card/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{meta.board.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            {state.viewportReady && !state.isMobileViewport && !isFilterMode
              ? `第 ${state.currentPage} 页 · ${state.visibleCount} 张`
              : `共 ${state.totalLoaded} 张`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {priorityEnabled ? <SearchBar /> : null}
          {priorityEnabled ? <SortDropdown /> : null}
          {viewMode !== undefined && onToggleViewMode ? (
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
              onClick={onToggleViewMode}
            >
              <LayoutList size={14} />
              流式视图
            </button>
          ) : null}
          {state.viewportReady && state.isMobileViewport && !isSearchMode && !priorityEnabled ? (
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
              onClick={actions.toggleMobileView}
            >
              {state.mobileView === 'stack' ? (
                <><LayoutList size={14} />列表视图</>
              ) : (
                <><Layers size={14} />卡片堆叠</>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Sidebar (desktop only, memo board) */}
        {priorityEnabled ? (
          <aside className="hidden shrink-0 sm:block sm:w-[180px] lg:w-[200px]">
            <div className="sticky top-6 space-y-6">
              <SidebarCalendar
                memoDateCounts={memoDateCounts}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              <SidebarTagCloud />
            </div>
          </aside>
        ) : null}

        {/* Main area */}
        <div className="min-w-0 flex-1">
          {/* Mobile calendar toggle */}
          {priorityEnabled ? (
            <div className="mb-3 sm:hidden">
              <button
                type="button"
                onClick={() => setMobileCalendarOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
              >
                <CalendarDays size={13} className="shrink-0" />
                <span className="flex-1 text-left">{effectiveSelectedDate ?? '按日期筛选'}</span>
                {effectiveSelectedDate ? (
                  <X size={12} onClick={(e) => { e.stopPropagation(); setSelectedDate(null) }} />
                ) : (
                  <ChevronDown size={12} className={`transition-transform${mobileCalendarOpen ? ' rotate-180' : ''}`} />
                )}
              </button>
              {mobileCalendarOpen ? (
                <div className="mt-2 rounded-2xl border border-border/60 bg-background/80 p-3">
                  <SidebarCalendar
                    memoDateCounts={memoDateCounts}
                    selectedDate={selectedDate}
                    onSelectDate={(key) => { setSelectedDate(key); if (key) setMobileCalendarOpen(false) }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Mobile tag strip */}
          {priorityEnabled && state.allTags.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-1.5 sm:hidden">
              {state.allTags.slice(0, 12).map(({ name }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => actions.handleTagFilter(name)}
                  className={[
                    'rounded-full px-2 py-0.5 text-[11px] transition',
                    state.activeTag === name
                      ? 'bg-foreground text-background'
                      : 'border border-border/70 text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  #{name}
                </button>
              ))}
              {state.activeTag ? (
                <button
                  type="button"
                  onClick={() => actions.handleTagFilter(state.activeTag)}
                  className="flex items-center gap-0.5 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <X size={10} />
                  清除
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Active filter banner */}
          {isFilterMode ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[16px] border border-border/60 bg-background/60 px-4 py-2 text-xs text-muted-foreground">
              <span className="flex-1">
                {state.searchQuery
                  ? `搜索："${state.searchQuery}"，共 ${state.visibleCount} 张`
                  : state.activeTag
                    ? `标签：#${state.activeTag}，共 ${state.visibleCount} 张`
                    : `日期：${effectiveSelectedDate}，共 ${dateFilteredCount} 张`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (state.searchQuery) actions.handleSearch('')
                  else if (state.activeTag) actions.handleTagFilter(state.activeTag)
                  else setSelectedDate(null)
                }}
                className="flex items-center gap-0.5 hover:text-foreground"
              >
                <X size={12} />
                清除筛选
              </button>
            </div>
          ) : null}

          {/* Board canvas */}
          {!state.viewportReady ? (
            <div
              className="rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:p-6"
              style={{ minHeight: 380 }}
            >
              <div className="h-full min-h-[280px] rounded-[24px] border border-dashed border-border/70 bg-white/55" />
            </div>
          ) : state.isMobileViewport ? (
            <div className="mb-12">
              {state.mobileView === 'stack' ? <MobileStickyStack items={state.noteItems} /> : <MobileNoteList items={state.noteItems} />}
            </div>
          ) : (
            <div>
              <div
                ref={bindContainer}
                className="note-board-canvas relative overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:p-6"
                style={{ minHeight: Math.max(meta.surface.height, 420) }}
              >
                {state.messages.length === 0 ? (
                  <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-white/55 text-center text-sm text-muted-foreground">
                    {state.showArchived ? '还没有已归档便签。' : isSearchMode ? '没有找到相关便签。' : meta.board.emptyLabel}
                  </div>
                ) : !meta.surface.hasMeasured ? null : (
                  <div className="relative" style={{ minHeight: Math.max(meta.surface.height, 320) }}>
                    {state.noteItems.map((item, index) => {
                      const { message, actions: cardActions, priorityControl, reactionControl, checklistControl, inlineEditor, isEditing, isOptimistic, isOptimisticEditing, isFresh } = item

                      if (effectiveSelectedDate) {
                        const ts = message.updated_at ?? message.created_at
                        const { year, month, day } = getShanghaDateParts(ts)
                        if (toDateKey(year, month, day) !== effectiveSelectedDate) return null
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

          {state.viewportReady && state.isMobileViewport && state.hasMore && !isSearchMode ? (
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
        </div>
      </div>
    </section>
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
            toolbarLeadingAddon={state.priorityEnabled ? (
              <PriorityPicker.Dot
                value={state.editorPriority}
                onChange={actions.updateEditorPriority}
                buttonClassName="h-8 w-8"
                dotClassName="h-2.5 w-2.5"
                menuAlign="start"
                menuDirection="up"
              />
            ) : undefined}
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

function NoteBoardExperience() {
  const meta = useNoteBoardMeta()
  const isMemoBoard = meta.board.slug === 'memo'

  const [viewMode, setViewMode] = useState<'sticky' | 'stream'>('sticky')

  // Restore persisted view mode after mount (localStorage is client-only;
  // initializing from it in useState causes a hydration mismatch)
  useEffect(() => {
    if (!isMemoBoard) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.localStorage.getItem('memo-view-mode') === 'stream') setViewMode('stream')
  }, [isMemoBoard])

  useEffect(() => {
    if (isMemoBoard) window.localStorage.setItem('memo-view-mode', viewMode)
  }, [viewMode, isMemoBoard])

  const toggleViewMode = useCallback(
    () => setViewMode((v) => (v === 'sticky' ? 'stream' : 'sticky')),
    [],
  )

  return (
    <div className="space-y-6">
      {isMemoBoard && viewMode === 'stream' ? (
        <MemosStreamView onToggleViewMode={toggleViewMode} />
      ) : (
        <NoteBoardControls
          viewMode={isMemoBoard ? viewMode : undefined}
          onToggleViewMode={isMemoBoard ? toggleViewMode : undefined}
        />
      )}
      <NoteBoardEditorSection autoFocusOnEdit={viewMode === 'stream'} />
      <NoteBoardToast />
    </div>
  )
}

export function NoteBoardPage({ board, initialMessages, initialQuery = '' }: NoteBoardPageProps) {
  return (
    <NoteBoardProvider board={board} initialMessages={initialMessages} initialQuery={initialQuery}>
      <NoteBoardExperience />
    </NoteBoardProvider>
  )
}
