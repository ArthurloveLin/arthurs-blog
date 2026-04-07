import Link from 'next/link'

import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'
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
  rank?: number | null
}

interface DraggableImageGridProps {
  items: Item[]
  sessionToken: string
}

export default function DraggableImageGrid({ items: initialItems, sessionToken }: DraggableImageGridProps) {
  const router = useRouter()
  const [orderedItems, setOrderedItems] = useState<Item[]>(initialItems)
  const isDraggingRef = useRef(false)
  const orderedItemsRef = useRef(orderedItems)
  orderedItemsRef.current = orderedItems

  // Keep ordered items in sync when parent re-renders (unless drag is in progress)
  useEffect(() => {
    if (isDraggingRef.current) return
    const newIds = initialItems.map((i) => i.id).join(',')
    const curIds = orderedItemsRef.current.map((i) => i.id).join(',')
    if (newIds !== curIds) setOrderedItems(initialItems)
  }, [initialItems])

  const onDragStart = useCallback(() => { isDraggingRef.current = true }, [])

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      isDraggingRef.current = false
      if (!result.destination || result.destination.index === result.source.index) return

      const reordered = Array.from(orderedItems)
      const [moved] = reordered.splice(result.source.index, 1)
      reordered.splice(result.destination.index, 0, moved)
      setOrderedItems(reordered)

      await fetch('/api/items/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
      })
      router.refresh()
    },
    [orderedItems, router]
  )

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <Droppable droppableId="grid" direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <div className="space-y-3">
              {orderedItems.map((item, index) => {
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
                        <div
                          {...provided.dragHandleProps}
                          className="pl-3 py-4 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 select-none"
                        >
                          ⠿
                        </div>
                        <Link
                          href={`/session/${sessionToken}/item/${item.id}`}
                          className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-gray-100"
                        >
                          <div className="relative w-full h-full">
                          <Image
                            src={item.image_url}
                            alt="衣服图片"
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                          </div>
                        </Link>
                        <Link
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
                        </Link>
                        {item.decision !== 'pending' && (
                          <div className={`mr-3 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            item.decision === 'buy' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                          }`}>
                             {item.decision === 'buy' ? '买' : '不买'}
                          </div>
                        )}
                        {item.rank && item.rank <= 3 && (
                          <div className={`mr-4 text-[10px] px-2 py-1 rounded-full font-black shadow-lg flex items-center gap-1 border border-white/20 shrink-0 ${
                            item.rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : 
                            item.rank === 2 ? 'bg-gradient-to-r from-slate-300 to-slate-500 text-white' : 
                            'bg-gradient-to-r from-amber-600 to-amber-800 text-white'
                          }`}>
                            <span>{item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}</span>
                            {item.rank === 1 ? '冠军' : item.rank === 2 ? '亚军' : '季军'}
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
  )
}
