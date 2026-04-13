'use client'

import { Layers, LayoutList } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { NoteEditor } from '@/components/note-board/components/NoteEditor'
import { StickyNoteCard } from '@/components/note-board/components/StickyNoteCard'
import { useElementSize } from '@/components/note-board/hooks/useElementSize'
import type { NotePosition, OptimisticMessageSnapshot, ToastNotice } from '@/components/note-board/types'
import {
  computeBoardLayout,
  getDeletePermission,
  getEditPermission,
  getStickyColorIndex,
} from '@/components/note-board/utils/board'
import { MobileNoteList } from '@/components/note-board/views/MobileNoteList'
import { MobileStickyStack } from '@/components/note-board/views/MobileStickyStack'
export { StickyStackPreview } from '@/components/note-board/views/StickyStackPreview'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

interface NoteBoardPageProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
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

export function NoteBoardPage({ board, initialMessages }: NoteBoardPageProps) {
  const { identity, isAdmin, loading } = useAuth()
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [messages, setMessages] = useState(initialMessages)
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({})
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
  const viewerIdentity = identity ?? ''
  const canWrite = board.slug === 'guestbook' || isAdmin
  const { cardWidth, height, layouts } = useMemo(
    () => computeBoardLayout(messages, size.width, measuredHeights),
    [measuredHeights, messages, size.width],
  )
  const hasMeasured = size.width > 0 && size.height > 0
  const editingMessage = useMemo(() => messages.find((message) => message.id === editingNoteId) ?? null, [messages, editingNoteId])

  useEffect(() => {
    setMeasuredHeights((current) => {
      const nextEntries = Object.entries(current).filter(([id]) => messages.some((message) => message.id === id))

      if (nextEntries.length === Object.keys(current).length) {
        return current
      }

      return Object.fromEntries(nextEntries)
    })
  }, [messages])

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

  function cancelEditingNote() {
    setEditingNoteId(null)
    setEditContent('')
    setError(null)
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
      setCustomPositions((current) => ({ ...current, [snapshot.message.id]: snapshot.customPosition! }))
    }

    if (typeof snapshot.zIndex === 'number') {
      setCardZIndices((current) => ({ ...current, [snapshot.message.id]: snapshot.zIndex! }))
    }

    setNextOffset((current) => current + 1)
  }

  function bringCardToFront(id: string) {
    setCardZIndices((current) => ({ ...current, [id]: zIndexCounterRef.current++ }))
  }

  function handleCardHeightChange(id: string, height: number) {
    setMeasuredHeights((current) => {
      if (current[id] === height) {
        return current
      }

      return { ...current, [id]: height }
    })
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

    if (window.matchMedia('(max-width: 767px)').matches) {
      scrollToEditor()
    }
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

  async function handleDelete(id: string) {
    if (!identity || pendingOptimisticIdsRef.current.has(id)) return

    const snapshot = buildOptimisticSnapshot(id, messages, customPositions, cardZIndices)
    if (!snapshot) return

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
    const response = await fetch(`/api/note-boards/${board.slug}?offset=${nextOffset}&limit=${board.pageSize}&archived=${showArchived ? '1' : '0'}`)
    if (!response.ok) {
      setError('更多便签加载失败，请稍后重试。')
      return
    }

    const payload = await response.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
    startTransition(() => {
      setMessages((current) => [...current, ...payload.messages])
      setNextOffset(payload.nextOffset)
      setHasMore(payload.hasMore)
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingMessage) {
      void saveEditingNote()
      return
    }
    void submitDraft()
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
          <div className="flex justify-end md:hidden">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
              onClick={() => setMobileView((value) => value === 'stack' ? 'list' : 'stack')}
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

        <div className="mb-12 md:hidden">
          {mobileView === 'stack' ? (
            <MobileStickyStack
              messages={messages}
              onDelete={handleDelete}
              onEdit={startEditingNote}
              onToggleArchive={handleToggleArchive}
              canDelete={(message) => getDeletePermission(board.slug, isAdmin, viewerIdentity, message)}
              canEdit={(message) => getEditPermission(isAdmin, viewerIdentity, message)}
            />
          ) : (
            <MobileNoteList
              messages={messages}
              onDelete={handleDelete}
              onEdit={startEditingNote}
              onToggleArchive={handleToggleArchive}
              canDelete={(message) => getDeletePermission(board.slug, isAdmin, viewerIdentity, message)}
              canEdit={(message) => getEditPermission(isAdmin, viewerIdentity, message)}
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
                      showDelete={getDeletePermission(board.slug, isAdmin, viewerIdentity, message)}
                      showEdit={getEditPermission(isAdmin, viewerIdentity, message)}
                      showArchive={getEditPermission(isAdmin, viewerIdentity, message)}
                      isInlineEditing={editingNoteId === message.id}
                      inlineEditContent={editingNoteId === message.id ? editContent : ''}
                      isSavingInline={isUpdatingNote}
                      onDelete={() => handleDelete(message.id)}
                      onEdit={() => startEditingNote(message)}
                      onToggleArchive={() => handleToggleArchive(message)}
                      onLift={() => bringCardToFront(message.id)}
                      onCommit={(nextPosition) => {
                        setCustomPositions((current) => ({ ...current, [message.id]: nextPosition }))
                      }}
                      onHeightChange={(nextHeight) => handleCardHeightChange(message.id, nextHeight)}
                      onInlineEditChange={setEditContent}
                      onInlineSave={() => void saveEditingNote()}
                      onInlineCancel={cancelEditingNote}
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
          <p className="text-xs text-muted-foreground">当前身份：{loading ? '加载中…' : viewerIdentity}</p>
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
          <p className="mt-4 text-sm leading-7 text-muted-foreground">这里先开放浏览，Memo 暂时由 admin 维护与更新。</p>
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