'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MemoHabitDetailPanel } from '@/components/note-board/views/MemoHabitDetailPanel'
import { NoteEditor } from '@/components/note-board/components/NoteEditor'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import { VisibilityPicker } from '@/components/note-board/components/VisibilityPicker'
import { StickyNoteCard } from '@/components/note-board/components/StickyNoteCard'
import { DueDateInserter } from '@/components/note-board/components/DueDateInserter'
import { useMemoHabits } from '@/components/note-board/hooks/useMemoHabits'
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
import { NoteColorThemeProvider, type NoteColorThemeId } from '@/components/note-board/contexts/NoteColorThemeContext'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import {
  getNoteBoardViewModeCookieName,
  getNoteBoardViewModeStorageKey,
  type NoteBoardViewMode,
} from '@/lib/note-board-view-mode'
import type { MemoHabitOverview } from '@/lib/memo-habits'
import type { MemoAgendaItem, NoteMessage } from '@/lib/note-boards'
import { getShanghaiDateParts, toDateKey } from '@/lib/shanghai-time'
import { EYEBROW } from '@/components/cardSurface'
export { StickyStackPreview } from '@/components/note-board/views/StickyStackPreview'

const MemosStreamView = dynamic(
  () => import('@/components/note-board/views/MemosStreamView').then((m) => m.MemosStreamView),
)

const MobileStickyStack = dynamic(
  () => import('@/components/note-board/views/MobileStickyStack').then((module) => module.MobileStickyStack),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[280px] animate-pulse rounded-[24px] border border-dashed border-border/50 bg-background/15" />
    ),
  },
)

interface NoteBoardPageProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
  initialQuery?: string
  initialViewMode?: NoteBoardViewMode
  initialThemeId?: NoteColorThemeId
}

function BoardStickyView({ onToggleViewMode, filters, agendaItems, habitOverview, onOpenHabitDetail, onCompleteHabitItem, showSidebar }: { onToggleViewMode: () => void; filters: MemoBoardFilters; agendaItems?: import('@/lib/note-boards').MemoAgendaItem[] | null; habitOverview?: MemoHabitOverview | null; onOpenHabitDetail?: (noteId: string, itemKey: string, source?: 'sidebar' | 'note') => void; onCompleteHabitItem?: (noteId: string, itemKey: string) => void; showSidebar: boolean }) {
  const state = useNoteBoardBoardState()
  const editorState = useNoteBoardEditorState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const bindings = useNoteBoardBindings()
  const bindContainer = useCallback((node: HTMLDivElement | null) => {
    bindings.bindContainer(node)
  }, [bindings])
  // When ANY filter is active (tag/search/date/due/history), pull from allNoteItems so
  // matches on page 2+ of the resident set are reachable — otherwise client-side
  // tag/search would only see the current paginated page. When unfiltered, keep the
  // paginated noteItems.
  const isFilterActive = filters.isFilterMode
  const shouldReflowLayout = isFilterActive
  const filteredNoteItems = useMemo(() => {
    const sourceItems = isFilterActive ? state.allNoteItems : state.noteItems
    const byDate = filters.filterItems(sourceItems)
    if (!state.activeDueDate || !agendaItems?.length) return byDate
    const matchingIds = new Set(
      agendaItems
        .filter((a: MemoAgendaItem) => {
          const { year, month, day } = getShanghaiDateParts(a.dueAt)
          return toDateKey(year, month, day) === state.activeDueDate
        })
        .map((a: MemoAgendaItem) => a.memoId),
    )
    return byDate.filter((item) => matchingIds.has(item.message.id))
  }, [filters, isFilterActive, state.noteItems, state.allNoteItems, state.activeDueDate, agendaItems])
  const summary = state.viewportReady && !state.isMobileViewport && !filters.isFilterMode && !state.activeDueDate
    ? `第 ${state.currentPage} 页 · ${filteredNoteItems.length} 张`
    : `共 ${state.totalLoaded} 张`
  const emptyLabel = state.showArchived
    ? '还没有已归档便签。'
    : filters.isFilterMode
      ? '没有匹配的内容。'
      : meta.board.emptyLabel
  const boardCardWidth = meta.surface.cardWidth
  const filteredSurfaceLayout = useMemo(() => {
    if (!shouldReflowLayout) {
      return null
    }

    return meta.surface.computeLayoutForMessages(filteredNoteItems.map((item) => item.message), boardCardWidth)
  }, [boardCardWidth, filteredNoteItems, meta.surface, shouldReflowLayout])
  const activeSurfaceHeight = filteredSurfaceLayout?.height ?? meta.surface.height
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
      showSidebar={showSidebar}
      agendaItems={agendaItems}
      habitOverview={habitOverview}
      onOpenHabitDetail={onOpenHabitDetail}
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
          <MobileStickyStack
            items={filteredNoteItems}
            habitStatesByNote={habitOverview?.currentStates}
            onOpenHabitDetail={onOpenHabitDetail}
            onCompleteHabitItem={onCompleteHabitItem}
          />
        </div>
      ) : (
        <div className="relative">
          <div
            ref={bindContainer}
            className={['note-board-canvas relative rounded-[28px] p-5 sm:p-6', editorState.editingMessage ? 'overflow-visible' : 'overflow-hidden'].join(' ')}
            style={{ minHeight: Math.max(activeSurfaceHeight, 420) }}
          >
            {!meta.surface.hasMeasured ? null : (
              <div className="relative" style={{ minHeight: Math.max(activeSurfaceHeight, 320) }}>
                {filteredNoteItems.map((item, index) => {
                  const { message, actions: cardActions, priorityControl, reactionControl, checklistControl, inlineEditor, isEditing, isOptimistic, isOptimisticEditing, isFresh } = item

                  const layout = filteredSurfaceLayout?.layouts[index] ?? meta.surface.layouts[index]
                  const collapsedPosition = {
                    x: Math.max((meta.surface.size.width - boardCardWidth) / 2, 0) + Math.min(index, 4) * 2,
                    y: 22 + Math.min(index, 4) * 4,
                    rotation: index % 2 === 0 ? -2 : 2,
                  }
                  const targetPosition = filteredSurfaceLayout
                    ? {
                        x: layout?.x ?? collapsedPosition.x,
                        y: layout?.y ?? collapsedPosition.y,
                        rotation: layout?.rotation ?? collapsedPosition.rotation,
                      }
                    : meta.surface.getTargetPosition(index)
                  // When filtering, ignore saved custom positions so cards can reflow from slot 0.
                  const custom = shouldReflowLayout ? undefined : state.customPositions[message.id]
                  const position = custom ?? (meta.surface.isScattered ? targetPosition : collapsedPosition)

                  return (
                    <StickyNoteCard.Board
                      key={message.id}
                      message={message}
                      x={position.x}
                      y={position.y}
                      rotation={position.rotation}
                      zIndex={state.cardZIndices[message.id] ?? layout?.zIndex ?? filteredNoteItems.length - index}
                      width={boardCardWidth}
                      bounds={{ width: meta.surface.size.width, height: Math.max(activeSurfaceHeight, 420) }}
                      colorIndex={layout?.colorIndex ?? getStickyColorIndex(getStickyColorSeed(message))}
                      draggable={meta.surface.isScattered && !isEditing}
                      actions={cardActions}
                      priorityControl={priorityControl}
                      reactionControl={reactionControl}
                      checklistControl={checklistControl}
                      habitStates={habitOverview?.currentStates[message.id]}
                      onOpenHabitDetail={onOpenHabitDetail}
                      onCompleteHabitItem={onCompleteHabitItem}
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

          {/* Pagination arrows are always rendered; disabled state greys them out
              (opacity-30) rather than hiding them, so "greyed vs bright" is the
              affordance for whether a page exists in that direction. */}
          <button
            type="button"
            aria-label="上一页"
            className="group absolute left-1 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 sm:left-2"
            style={{ top: 400 }}
            onClick={actions.handlePreviousPage}
            disabled={!state.hasPreviousPage || state.isPending || state.isRefreshingBoard}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="下一页"
            className="group absolute right-0 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 sm:-right-3"
            style={{ top: 400 }}
            onClick={() => void actions.handleNextPage()}
            disabled={!state.hasNextPage || state.isPending || state.isRefreshingBoard}
          >
            <ChevronRight size={20} />
          </button>
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


function NoteBoardEditorSection({ autoFocusOnEdit = false }: { autoFocusOnEdit?: boolean }) {
  const state = useNoteBoardEditorState()
  const boardState = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const bindings = useNoteBoardBindings()
  const bindEditorSection = useCallback((node: HTMLElement | null) => {
    bindings.bindEditorSection(node)
  }, [bindings])

  return (
    <section ref={bindEditorSection} className="rounded-[28px] border border-border/60 bg-card/95 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`${EYEBROW} text-[11px]`}>{state.editorSectionLabel}</p>
        </div>
        <p className="text-xs text-muted-foreground">当前身份：{state.loadingIdentity ? '加载中…' : state.viewerIdentity}</p>
      </div>

      {state.editorMode === 'edit' ? (
        <div className="mt-4 rounded-[24px] border border-dashed border-border/70 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
          正在编辑 {state.editingMessage?.author} 的{meta.board.slug === 'guestbook' ? '留言' : '便签'}。保存后内容时间会自动刷新。
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
            toolbarLeadingAddon={(insertAtCursor) => (
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
                {state.isAdmin && meta.board.slug === 'memo' ? <DueDateInserter insertAtCursor={insertAtCursor} /> : null}
              </>
            )}
            autoFocus={state.editorMode === 'edit' && (boardState.isMobileViewport || autoFocusOnEdit)}
          />
        </form>
      ) : (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">这里先开放浏览，暂时由 admin 维护与更新。</p>
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
    <div className="pointer-events-none fixed inset-x-4 bottom-5 z-[var(--z-toast)] flex justify-center sm:justify-end">
      <div className="rounded-full bg-slate-950 px-4 py-2 text-sm text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
        {toastNotice.message}
      </div>
    </div>
  )
}

function NoteBoardExperience({ initialViewMode = 'sticky' }: { initialViewMode?: NoteBoardViewMode }) {
  const meta = useNoteBoardMeta()
  const state = useNoteBoardBoardState()
  const editorState = useNoteBoardEditorState()
  const viewModeStorageKey = getNoteBoardViewModeStorageKey(meta.board.slug)
  const viewModeCookieName = getNoteBoardViewModeCookieName(meta.board.slug)

  // Date counts are derived client-side from the resident working set (see
  // useMemoBoardFilters), so they reflect the CURRENT view — active vs archived.
  // The old /memo/dates endpoint hardcoded archived:false and showed active counts
  // even in the archived view.
  const filters = useMemoBoardFilters(state.allNoteItems)

  const {
    agendaItems: enrichedAgendaItems,
    habitOverview,
    selectedHabit,
    selectedHabitDetail,
    isHabitDetailLoading,
    openHabitDetail,
    closeHabitDetail,
    handleCompleteHabit,
    handleCompleteHabitItem,
    handleDelayHabit,
    handleDeleteOccurrence,
  } = useMemoHabits({ enabled: meta.board.slug === 'memo' })

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
        ? <MemosStreamView onToggleViewMode={toggleViewMode} filters={filters} agendaItems={enrichedAgendaItems ?? null} habitOverview={habitOverview ?? null} onOpenHabitDetail={editorState.isAdmin ? openHabitDetail : undefined} onCompleteHabitItem={editorState.isAdmin ? handleCompleteHabitItem : undefined} showSidebar={meta.board.slug === 'memo'} />
        : <BoardStickyView onToggleViewMode={toggleViewMode} filters={filters} agendaItems={enrichedAgendaItems ?? null} habitOverview={habitOverview ?? null} onOpenHabitDetail={editorState.isAdmin ? openHabitDetail : undefined} onCompleteHabitItem={editorState.isAdmin ? handleCompleteHabitItem : undefined} showSidebar={meta.board.slug === 'memo'} />}
      <NoteBoardEditorSection autoFocusOnEdit={viewMode === 'stream'} />
      <NoteBoardToast />
      {editorState.isAdmin && (
        <MemoHabitDetailPanel
          detail={selectedHabitDetail}
          isLoading={Boolean(selectedHabit) && isHabitDetailLoading}
          isMobile={state.isMobileViewport}
          anchorPos={selectedHabit?.anchorPos}
          onClose={closeHabitDetail}
          onComplete={handleCompleteHabit}
          onDelay={handleDelayHabit}
          onDeleteOccurrence={handleDeleteOccurrence}
        />
      )}
    </div>
  )
}

export function NoteBoardPage({ board, initialMessages, initialQuery = '', initialViewMode = 'sticky', initialThemeId }: NoteBoardPageProps) {
  return (
    <NoteColorThemeProvider initialThemeId={initialThemeId}>
      <NoteBoardProvider board={board} initialMessages={initialMessages} initialQuery={initialQuery}>
        <NoteBoardExperience initialViewMode={initialViewMode} />
      </NoteBoardProvider>
    </NoteColorThemeProvider>
  )
}
