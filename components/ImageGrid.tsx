'use client'

import Image from 'next/image'
import { useState, memo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TemplateConfig } from '@/lib/templates'

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

interface ImageGridProps {
  items: Item[]
  sessionToken: string
  templateConfig?: TemplateConfig
}

interface ImageGridSection {
  key: string
  label?: string
  items: Item[]
}

interface ImageGridController {
  mode: 'browse' | 'select'
  deletingId: string | null
  isBulkDeleting: boolean
  selectedIds: Set<string>
  selectedCount: number
  startSelection: () => void
  resetSelection: () => void
  toggleSelection: (id: string) => void
  deleteItem: (id: string) => Promise<void>
  deleteSelected: () => Promise<void>
}

const CATEGORY_ORDER = ['上衣', '裤子', '鞋子', '配饰', '其他', '未分类']

function buildImageGridSections(items: Item[]): ImageGridSection[] {
  const hasCategories = items.some((item) => item.category)

  if (!hasCategories) {
    return [{ key: 'all-items', items }]
  }

  const groupedItems = items.reduce<Record<string, Item[]>>((accumulator, item) => {
    const category = item.category || '未分类'
    if (!accumulator[category]) {
      accumulator[category] = []
    }
    accumulator[category].push(item)
    return accumulator
  }, {})

  return Object.keys(groupedItems)
    .sort((left, right) => {
      const leftIndex = CATEGORY_ORDER.indexOf(left)
      const rightIndex = CATEGORY_ORDER.indexOf(right)
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
      if (leftIndex === -1) return 1
      if (rightIndex === -1) return -1
      return leftIndex - rightIndex
    })
    .map((category) => ({
      key: category,
      label: category,
      items: groupedItems[category],
    }))
}

function useImageGridController(): ImageGridController {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mode, setMode] = useState<'browse' | 'select'>('browse')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  async function deleteItem(id: string) {
    if (!confirm('确定删除这张图片吗？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function resetSelection() {
    setMode('browse')
    setSelectedIds(new Set())
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 张图片吗？`)) return
    setIsBulkDeleting(true)
    try {
      const res = await fetch('/api/items/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('Bulk delete failed')
      resetSelection()
      router.refresh()
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return {
    mode,
    deletingId,
    isBulkDeleting,
    selectedIds,
    selectedCount: selectedIds.size,
    startSelection: () => setMode('select'),
    resetSelection,
    toggleSelection,
    deleteItem,
    deleteSelected,
  }
}

function ImageGridEmptyState({ templateConfig }: { templateConfig?: TemplateConfig }) {
  const emptyEmoji = templateConfig?.name === '美食' ? '🍽️' : templateConfig?.name === '打卡' ? '🗺️' : '📷'
  const emptyHint = templateConfig?.name === '美食'
    ? '上传第一张美食照片，开始探店点评吧～'
    : templateConfig?.name === '打卡'
    ? '上传第一张打卡照片，开始记录吧～'
    : '上传第一张，开始选衣吧～'

  return (
    <div className="text-center py-24 text-muted-foreground/50">
      <div className="text-6xl mb-5 opacity-40">{emptyEmoji}</div>
      <p className="text-base font-semibold text-muted-foreground/60">还没有内容</p>
      <p className="text-sm mt-2 opacity-60">{emptyHint}</p>
    </div>
  )
}

function ImageGridToolbar({ controller }: { controller: ImageGridController }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {controller.mode === 'select' && controller.selectedCount > 0 && (
          <button
            onClick={controller.deleteSelected}
            disabled={controller.isBulkDeleting}
            className="px-3 py-1 rounded-full text-xs bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {controller.isBulkDeleting ? '删除中…' : `删除 ${controller.selectedCount} 张`}
          </button>
        )}
        {controller.mode === 'select' && (
          <button
            onClick={controller.resetSelection}
            className="px-3 py-1 rounded-full text-xs bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            取消
          </button>
        )}
      </div>
      {controller.mode === 'browse' && (
        <button
          onClick={controller.startSelection}
          className="px-3 py-1 rounded-full text-xs bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 ml-auto transition-colors"
        >
          批量选择
        </button>
      )}
    </div>
  )
}

function ImageGridSections({
  sections,
  controller,
  sessionToken,
  templateConfig,
}: {
  sections: ImageGridSection[]
  controller: ImageGridController
  sessionToken: string
  templateConfig?: TemplateConfig
}) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.key} className="space-y-3">
          {section.label && (
            <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full opacity-60" />
              {section.label}
              <span className="text-xs font-normal opacity-50">({section.items.length})</span>
            </h3>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {section.items.map((item) => (
              <ImageGridCard
                key={item.id}
                item={item}
                controller={controller}
                sessionToken={sessionToken}
                templateConfig={templateConfig}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ImageGridCard({
  item,
  controller,
  sessionToken,
  templateConfig,
}: {
  item: Item
  controller: ImageGridController
  sessionToken: string
  templateConfig?: TemplateConfig
}) {
  const scoreDiff = item.arthurScore !== null && item.graceScore !== null
    ? Math.abs(item.arthurScore - item.graceScore)
    : null
  const hasConflict = scoreDiff !== null && scoreDiff >= 2

  return (
    <div className="relative group rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
      {controller.mode === 'select' ? (
        <SelectableItemCard
          item={item}
          selected={controller.selectedIds.has(item.id)}
          onToggleSelect={controller.toggleSelection}
        />
      ) : (
        <ViewableItemCard
          item={item}
          sessionToken={sessionToken}
          deleting={controller.deletingId}
          onDelete={controller.deleteItem}
          hasConflict={hasConflict}
          scoreDiff={scoreDiff}
          templateConfig={templateConfig}
        />
      )}
    </div>
  )
}

export default function ImageGrid({ items: initialItems, sessionToken, templateConfig }: ImageGridProps) {
  const controller = useImageGridController()
  const sections = buildImageGridSections(initialItems)

  if (initialItems.length === 0) {
    return <ImageGridEmptyState templateConfig={templateConfig} />
  }

  return (
    <div>
      <ImageGridToolbar controller={controller} />
      <ImageGridSections
        sections={sections}
        controller={controller}
        sessionToken={sessionToken}
        templateConfig={templateConfig}
      />
    </div>
  )
}

const SelectableItemCard = memo(({
  item,
  selected,
  onToggleSelect,
}: {
  item: Item
  selected: boolean
  onToggleSelect: (id: string) => void
}) => {
  return (
    <div
      onClick={() => onToggleSelect(item.id)}
      className="cursor-pointer h-full"
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
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg shadow-lg">
              ✓
            </div>
          </div>
        )}
      </div>
      <div className="p-2 space-y-0.5">
        {item.price !== null && (
          <p className="text-xs font-semibold text-foreground">¥{item.price}</p>
        )}
      </div>
    </div>
  )
})
SelectableItemCard.displayName = 'SelectableItemCard'

const ViewableItemCard = memo(({
  item,
  sessionToken,
  deleting,
  onDelete,
  hasConflict,
  scoreDiff,
  templateConfig,
}: {
  item: Item
  sessionToken: string
  deleting: string | null
  onDelete: (id: string) => void
  hasConflict: boolean
  scoreDiff: number | null
  templateConfig?: TemplateConfig
}) => {
  const buyLabel = templateConfig?.descLabels?.buy || '买'
  const skipLabel = templateConfig?.descLabels?.skip || '不买'

  return (
    <>
      <Link
        href={`/session/${sessionToken}/item/${item.id}`}
        className="block h-full bg-card"
      >
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
            <div className="absolute bottom-1 right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-sm">
              ⚡{scoreDiff?.toFixed(0)}
            </div>
          )}

          {/* Rank Medal - Ribbon Style */}
          {item.rank && item.rank <= 3 && (
            <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden z-20 pointer-events-none">
              <div className={`absolute top-[18px] right-[-24px] w-[90px] rotate-45 text-white text-[9px] font-black py-0.5 shadow-xl border-y border-white/20 text-center uppercase tracking-tighter ${
                item.rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-champion-shine bg-[length:200%_100%]' : 
                item.rank === 2 ? 'bg-gradient-to-r from-slate-300 to-slate-500' : 
                'bg-gradient-to-r from-amber-600 to-amber-800'
              }`}>
                {item.rank === 1 ? '🥇 冠军' : item.rank === 2 ? '🥈 亚军' : '🥉 季军'}
              </div>
            </div>
          )}
        </div>
        <div className="p-2 space-y-0.5">
          {item.price !== null && (
            <p className="text-xs font-semibold text-foreground">¥{item.price}</p>
          )}
          {item.avgScore !== null ? (
            <p className="text-xs text-yellow-500 font-medium">
              {'★'.repeat(Math.round(item.avgScore))}
              {'☆'.repeat(5 - Math.round(item.avgScore))}
              <span className="text-muted-foreground ml-1">{item.avgScore.toFixed(1)}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/40">暂无评分</p>
          )}
          {item.commentCount > 0 && (
            <p className="text-xs text-muted-foreground">{item.commentCount} 条评论</p>
          )}
        </div>
      </Link>

      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); onDelete(item.id) }}
        disabled={deleting === item.id}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive shadow-sm disabled:bg-muted-foreground"
      >
        {deleting === item.id ? '…' : '×'}
      </button>

      {/* Decision badge */}
      {item.decision !== 'pending' && (
        <div className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm ${
          item.decision === 'buy'
            ? 'bg-green-500 text-white'
            : 'bg-zinc-500 text-white'
        }`}>
          {item.decision === 'buy' ? buyLabel : skipLabel}
        </div>
      )}
    </>
  )
})

ViewableItemCard.displayName = 'ViewableItemCard'
