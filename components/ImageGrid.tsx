'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

interface Item {
  id: string
  image_url: string
  decision: 'buy' | 'skip' | 'pending'
  price: number | null
  position: number
  category: string | null
  created_at: string
  avgScore: number | null
  arthurScore: number | null
  graceScore: number | null
  commentCount: number
}

interface ImageGridProps {
  items: Item[]
  sessionToken: string
  draggable?: boolean
}

export default function ImageGrid({ items: initialItems, sessionToken, draggable = false }: ImageGridProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [orderedItems, setOrderedItems] = useState<Item[]>(initialItems)

  // Keep ordered items in sync when parent re-renders (unless drag is in progress)
  const [isDragging, setIsDragging] = useState(false)
  if (!isDragging && JSON.stringify(initialItems.map((i) => i.id)) !== JSON.stringify(orderedItems.map((i) => i.id))) {
    setOrderedItems(initialItems)
  }

  const displayItems = draggable ? orderedItems : initialItems

  // Group items if categories exist
  const hasCategories = initialItems.some((i) => i.category)
  const groupedItems = !draggable && hasCategories
    ? initialItems.reduce((acc, item) => {
        const cat = item.category || '未分类'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(item)
        return acc
      }, {} as Record<string, Item[]>)
    : null

  const CATEGORY_ORDER = ['上衣', '裤子', '鞋子', '配饰', '其他', '未分类']
  const sortedCategoryKeys = groupedItems
    ? Object.keys(groupedItems).sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a)
        const indexB = CATEGORY_ORDER.indexOf(b)
        if (indexA === -1 && indexB === -1) return a.localeCompare(b)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
    : []

  async function handleDelete(id: string) {
    if (!confirm('确定删除这张图片吗？')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`确定删除选中的 ${selected.size} 张图片吗？`)) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/items/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      if (!res.ok) throw new Error('Bulk delete failed')
      setSelected(new Set())
      setSelectMode(false)
      router.refresh()
    } finally {
      setBulkDeleting(false)
    }
  }

  const onDragStart = useCallback(() => setIsDragging(true), [])

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      setIsDragging(false)
      if (!result.destination || result.destination.index === result.source.index) return

      const reordered = Array.from(orderedItems)
      const [moved] = reordered.splice(result.source.index, 1)
      reordered.splice(result.destination.index, 0, moved)
      setOrderedItems(reordered)

      // Persist new positions
      await Promise.all(
        reordered.map((item, idx) =>
          fetch(`/api/items/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: idx }),
          })
        )
      )
      router.refresh()
    },
    [orderedItems, router]
  )

  if (displayItems.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-6xl mb-4">📷</div>
        <p className="text-base">还没有图片</p>
        <p className="text-sm mt-1">上传第一张，开始选衣吧～</p>
      </div>
    )
  }

  const grid = (
    <div className="space-y-8">
      {groupedItems ? (
        sortedCategoryKeys.map((cat) => (
          <div key={cat} className="space-y-3">
            <h3 className="text-sm font-bold text-gray-500 flex items-center gap-2">
              <span className="w-1 h-4 bg-pink-400 rounded-full" />
              {cat}
              <span className="text-xs font-normal text-gray-300">
                ({groupedItems[cat].length})
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {groupedItems[cat].map((item) => (
                <div
                  key={item.id}
                  className="relative group rounded-xl overflow-hidden bg-gray-100 shadow-sm"
                >
                  <ItemCard
                    item={item}
                    sessionToken={sessionToken}
                    deleting={deleting}
                    onDelete={handleDelete}
                    hasConflict={
                      item.arthurScore !== null &&
                      item.graceScore !== null &&
                      Math.abs(item.arthurScore - item.graceScore) >= 2
                    }
                    scoreDiff={
                      item.arthurScore !== null && item.graceScore !== null
                        ? Math.abs(item.arthurScore - item.graceScore)
                        : null
                    }
                    selectMode={selectMode}
                    selected={selected.has(item.id)}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {displayItems.map((item, index) => {
            const scoreDiff =
              item.arthurScore !== null && item.graceScore !== null
                ? Math.abs(item.arthurScore - item.graceScore)
                : null
            const hasConflict = scoreDiff !== null && scoreDiff >= 2

            return (
              <div
                key={item.id}
                className="relative group rounded-xl overflow-hidden bg-gray-100 shadow-sm"
              >
                <ItemCard
                  item={item}
                  sessionToken={sessionToken}
                  deleting={deleting}
                  onDelete={handleDelete}
                  hasConflict={hasConflict}
                  scoreDiff={scoreDiff}
                  selectMode={selectMode}
                  selected={selected.has(item.id)}
                  onToggleSelect={toggleSelect}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {selectMode && selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-3 py-1 rounded-full text-xs bg-red-500 text-white disabled:opacity-50"
            >
              {bulkDeleting ? '删除中…' : `删除 ${selected.size} 张`}
            </button>
          )}
          {selectMode && (
            <button
              onClick={() => { setSelectMode(false); setSelected(new Set()) }}
              className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
            >
              取消
            </button>
          )}
        </div>
        {!selectMode && (
          <button
            onClick={() => setSelectMode(true)}
            className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 ml-auto"
          >
            批量选择
          </button>
        )}
      </div>

      {draggable ? (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <Droppable droppableId="grid" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {/* Draggable items in a vertical list for simplicity */}
                <div className="space-y-3">
                  {displayItems.map((item, index) => {
                    const scoreDiff =
                      item.arthurScore !== null && item.graceScore !== null
                        ? Math.abs(item.arthurScore - item.graceScore)
                        : null
                    const hasConflict = scoreDiff !== null && scoreDiff >= 2

                    return (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`relative flex items-center gap-3 bg-white rounded-xl shadow-sm overflow-hidden transition-shadow ${
                              snapshot.isDragging ? 'shadow-xl ring-2 ring-pink-400' : ''
                            }`}
                          >
                            {/* Drag handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="pl-3 py-4 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 select-none"
                            >
                              ⠿
                            </div>
                            {/* Thumbnail */}
                            <a
                              href={`/session/${sessionToken}/item/${item.id}`}
                              className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-gray-100"
                            >
                              <Image
                                src={item.image_url}
                                alt="衣服图片"
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            </a>
                            {/* Info */}
                            <a
                              href={`/session/${sessionToken}/item/${item.id}`}
                              className="flex-1 min-w-0 py-2"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.price !== null && (
                                  <span className="text-sm font-semibold text-gray-700">¥{item.price}</span>
                                )}
                                {item.avgScore !== null ? (
                                  <span className="text-xs text-yellow-500 font-medium">
                                    {'★'.repeat(Math.round(item.avgScore))}
                                    {'☆'.repeat(5 - Math.round(item.avgScore))}
                                    <span className="text-gray-400 ml-1">{item.avgScore.toFixed(1)}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300">暂无评分</span>
                                )}
                                {hasConflict && (
                                  <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                                    ⚡ 分歧 {scoreDiff?.toFixed(1)}
                                  </span>
                                )}
                              </div>
                              {item.arthurScore !== null && item.graceScore !== null && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Arthur {item.arthurScore} · Grace {item.graceScore}
                                </p>
                              )}
                            </a>
                            {/* Decision badge */}
                            {item.decision !== 'pending' && (
                              <div className={`mr-3 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                item.decision === 'buy' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                              }`}>
                                {item.decision === 'buy' ? '买' : '不买'}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        grid
      )}
    </div>
  )
}

function ItemCard({
  item,
  sessionToken,
  deleting,
  onDelete,
  hasConflict,
  scoreDiff,
  selectMode,
  selected,
  onToggleSelect,
}: {
  item: Item
  sessionToken: string
  deleting: string | null
  onDelete: (id: string) => void
  hasConflict: boolean
  scoreDiff: number | null
  selectMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
}) {
  return (
    <>
      {selectMode ? (
        <div
          onClick={() => onToggleSelect(item.id)}
          className="cursor-pointer"
        >
          <div className="relative aspect-square">
            <Image
              src={item.image_url}
              alt="衣服图片"
              fill
              className={`object-cover transition-opacity ${selected ? 'opacity-60' : ''}`}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
            {selected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-lg">
                  ✓
                </div>
              </div>
            )}
          </div>
          <div className="p-2 space-y-0.5">
            {item.price !== null && (
              <p className="text-xs font-semibold text-gray-700">¥{item.price}</p>
            )}
          </div>
        </div>
      ) : (
        <a href={`/session/${sessionToken}/item/${item.id}`}>
          <div className="relative aspect-square">
            <Image
              src={item.image_url}
              alt="衣服图片"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
            {/* Score conflict indicator */}
            {hasConflict && (
              <div className="absolute bottom-1 right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                ⚡{scoreDiff?.toFixed(0)}
              </div>
            )}
          </div>

          <div className="p-2 space-y-0.5">
            {item.price !== null && (
              <p className="text-xs font-semibold text-gray-700">¥{item.price}</p>
            )}
            {item.avgScore !== null ? (
              <p className="text-xs text-yellow-500 font-medium">
                {'★'.repeat(Math.round(item.avgScore))}
                {'☆'.repeat(5 - Math.round(item.avgScore))}
                <span className="text-gray-400 ml-1">{item.avgScore.toFixed(1)}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-300">暂无评分</p>
            )}
            {item.commentCount > 0 && (
              <p className="text-xs text-gray-400">{item.commentCount} 条评论</p>
            )}
          </div>
        </a>
      )}

      {/* Delete button (hidden in select mode) */}
      {!selectMode && (
        <button
          onClick={(e) => { e.preventDefault(); onDelete(item.id) }}
          disabled={deleting === item.id}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500 disabled:bg-gray-400"
        >
          {deleting === item.id ? '…' : '×'}
        </button>
      )}

      {/* Decision badge */}
      {item.decision !== 'pending' && !selectMode && (
        <div className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${
          item.decision === 'buy'
            ? 'bg-green-500 text-white'
            : 'bg-gray-500 text-white'
        }`}>
          {item.decision === 'buy' ? '买' : '不买'}
        </div>
      )}
    </>
  )
}
