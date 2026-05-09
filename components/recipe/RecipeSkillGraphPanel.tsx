'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, X } from 'lucide-react'
import { useRecipeSkillGraph } from './RecipeSkillGraphProvider'

const SkillTreeGraph = dynamic(() => import('./SkillTreeGraph'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded border border-amber-800/15 animate-pulse"
      style={{ height: 140 }}
      aria-hidden="true"
    />
  ),
})

interface Props {
  currentRecipeId: string
  mutedStyle: React.CSSProperties
}

interface RelationItem {
  id: string
  title: string
  skillLabel: string
}

function RelationColumn({
  title,
  emptyLabel,
  items,
  mutedStyle,
  align = 'left',
}: {
  title: string
  emptyLabel: string
  items: RelationItem[]
  mutedStyle: React.CSSProperties
  align?: 'left' | 'right'
}) {
  const textAlignClass = align === 'right' ? 'text-right' : 'text-left'

  return (
    <div className="min-w-0 space-y-2">
      <p className={`text-[9px] font-mono tracking-[0.18em] uppercase ${textAlignClass}`} style={mutedStyle}>
        {title}
      </p>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.id}-${item.skillLabel}`}
              className={`rounded-xl border border-amber-800/15 bg-white/65 px-2.5 py-2 shadow-[0_10px_24px_rgba(120,53,15,0.06)] ${textAlignClass}`}
            >
              <p className="text-[10px] font-semibold leading-snug text-amber-950/85">
                {item.title}
              </p>
              <p className="mt-1 text-[9px] leading-relaxed" style={mutedStyle}>
                {item.skillLabel}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className={`rounded-xl border border-dashed border-amber-800/15 px-2.5 py-3 text-[9px] leading-relaxed ${textAlignClass}`} style={mutedStyle}>
          {emptyLabel}
        </div>
      )}
    </div>
  )
}

function SkillGraphModal({
  open,
  onClose,
  currentRecipeTitle,
  currentRecipeId,
  mutedStyle,
  graph,
  prerequisites,
  continuations,
}: {
  open: boolean
  onClose: () => void
  currentRecipeTitle: string
  currentRecipeId: string
  mutedStyle: React.CSSProperties
  graph: ReturnType<typeof useRecipeSkillGraph>['graph']
  prerequisites: RelationItem[]
  continuations: RelationItem[]
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open || !mounted) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-stone-950/72 p-4 backdrop-blur-sm md:p-8" onClick={onClose}>
      <div
        className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#120d08]/95 text-stone-50 shadow-[0_28px_120px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-7 md:py-5">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.35em] text-stone-400">技能图谱</p>
            <h3 className="mt-1 text-lg font-semibold text-stone-50 md:text-xl">{currentRecipeTitle}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-300">
              箭头方向表示从前置菜谱流向后续菜谱。高亮节点是当前菜谱，拖拽画布或滚轮缩放可以查看全局结构。
            </p>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-stone-200 transition hover:bg-white/12"
            onClick={onClose}
            aria-label="关闭技能图谱"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 py-4 md:grid-cols-[280px_minmax(0,1fr)] md:px-6 md:py-6">
          <aside className="overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
            <div className="rounded-2xl border border-amber-300/18 bg-amber-300/8 px-3.5 py-3.5">
              <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-amber-100/70">当前焦点</p>
              <p className="mt-2 text-base font-semibold text-amber-50">{currentRecipeTitle}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-stone-200/85">
                <span className="rounded-full border border-white/12 px-2.5 py-1">前置 {prerequisites.length}</span>
                <span className="rounded-full border border-white/12 px-2.5 py-1">后续 {continuations.length}</span>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-stone-400">阅读方式</p>
                <ul className="mt-2 space-y-2 text-sm leading-relaxed text-stone-300">
                  <li>高亮节点表示当前菜谱。</li>
                  <li>橙色关系标签只标出和当前菜谱直接相连的技能衔接。</li>
                  <li>其余节点保留在全局网络里，方便补齐整体路径。</li>
                </ul>
              </div>

              <div>
                <RelationColumn
                  title="前置菜谱"
                  emptyLabel="当前菜谱还没有配置前置菜谱。"
                  items={prerequisites}
                  mutedStyle={mutedStyle}
                />
              </div>

              <div>
                <RelationColumn
                  title="后续延伸"
                  emptyLabel="当前菜谱还没有配置后续延伸。"
                  items={continuations}
                  mutedStyle={mutedStyle}
                />
              </div>
            </div>
          </aside>

          <div className="min-h-0 overflow-hidden rounded-[24px] border border-white/10 bg-stone-950/75 p-2 md:p-4">
            <SkillTreeGraph graph={graph} currentRecipeId={currentRecipeId} height={560} variant="modal" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function RecipeSkillGraphPanel({ currentRecipeId, mutedStyle }: Props) {
  const { graph, connectedRecipeIds, hasMultipleNodes } = useRecipeSkillGraph()
  const [isGlobalOpen, setIsGlobalOpen] = useState(false)
  const hasSkillLinks = connectedRecipeIds.has(currentRecipeId) || hasMultipleNodes

  const nodeMap = useMemo(() => {
    return new Map(graph.nodes.map((node) => [node.id, node]))
  }, [graph.nodes])

  const prerequisites = useMemo<RelationItem[]>(() => {
    return graph.links
      .filter((link) => String(link.target) === currentRecipeId)
      .map((link) => {
        const node = nodeMap.get(String(link.source))

        if (!node) {
          return null
        }

        return {
          id: node.id,
          title: node.title,
          skillLabel: link.skill_label,
        }
      })
      .filter((item): item is RelationItem => item != null)
  }, [currentRecipeId, graph.links, nodeMap])

  const continuations = useMemo<RelationItem[]>(() => {
    return graph.links
      .filter((link) => String(link.source) === currentRecipeId)
      .map((link) => {
        const node = nodeMap.get(String(link.target))

        if (!node) {
          return null
        }

        return {
          id: node.id,
          title: node.title,
          skillLabel: link.skill_label,
        }
      })
      .filter((item): item is RelationItem => item != null)
  }, [currentRecipeId, graph.links, nodeMap])

  const currentRecipeTitle = nodeMap.get(currentRecipeId)?.title ?? '当前菜谱'

  if (!hasSkillLinks) {
    return null
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-mono tracking-widest uppercase" style={mutedStyle}>
            技能路径
          </p>
          <button
            type="button"
            data-bs-no-drag="true"
            onClick={() => setIsGlobalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-mono tracking-[0.15em] uppercase text-stone-500/60 transition hover:text-stone-700 hover:opacity-100"
          >
            <Maximize2 size={11} strokeWidth={2.5} />
            <span>全局图</span>
          </button>
        </div>

        <SkillTreeGraph graph={graph} currentRecipeId={currentRecipeId} height={140} variant="inline" />
      </div>

      <SkillGraphModal
        open={isGlobalOpen}
        onClose={() => setIsGlobalOpen(false)}
        currentRecipeTitle={currentRecipeTitle}
        currentRecipeId={currentRecipeId}
        mutedStyle={mutedStyle}
        graph={graph}
        prerequisites={prerequisites}
        continuations={continuations}
      />
    </>
  )
}
