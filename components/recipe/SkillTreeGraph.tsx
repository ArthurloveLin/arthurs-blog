'use client'

import { useCallback, useId, useMemo, useRef } from 'react'
import type { SkillGraphData } from '@/lib/recipes'

interface Props {
  graph: SkillGraphData
  currentRecipeId: string
  height?: number
  variant?: 'inline' | 'modal'
}

// ── Dimensions (vertical layout: rows = depth levels, cols = nodes per level) ─

const DIM = {
  inline: { NW: 80, NH: 26, RG: 40, CG: 14, PAD: 10, FS: 7.5, LFS: 6.5 },
  modal:  { NW: 116, NH: 38, RG: 58, CG: 24, PAD: 28, FS: 11,  LFS: 9   },
} as const

// ── Internal types ────────────────────────────────────────────────────────────

interface LNode {
  id: string
  slug: string
  title: string
  published: boolean
  x: number
  y: number
}

interface LLink {
  id: string
  source: LNode
  target: LNode
  skill_label: string
  isActive: boolean
}

// ── Layout algorithm ──────────────────────────────────────────────────────────

function computeLayout(
  graph: SkillGraphData,
  currentId: string,
  variant: 'inline' | 'modal',
): { nodes: LNode[]; links: LLink[]; W: number; H: number } {
  const d = DIM[variant]
  let { nodes: rn, links: rl } = graph

  // Inline: only show immediate neighborhood (current + 1-hop neighbors)
  if (variant === 'inline') {
    const visible = new Set([currentId])
    for (const l of rl) {
      if (l.source === currentId) visible.add(l.target)
      if (l.target === currentId) visible.add(l.source)
    }
    rn = rn.filter((n) => visible.has(n.id))
    rl = rl.filter((l) => visible.has(l.source) && visible.has(l.target))
  }

  if (rn.length === 0) return { nodes: [], links: [], W: 0, H: 0 }

  const nodeSet = new Set(rn.map((n) => n.id))
  const preds = new Map<string, string[]>(rn.map((n) => [n.id, []]))
  for (const l of rl) {
    if (nodeSet.has(l.source) && nodeSet.has(l.target)) {
      preds.get(l.target)?.push(l.source)
    }
  }

  // Longest-path depth assignment (ensures edges always go top → bottom)
  const memo = new Map<string, number>()
  function depth(id: string, stack = new Set<string>()): number {
    if (memo.has(id)) return memo.get(id)!
    if (stack.has(id)) return 0
    stack.add(id)
    const ps = preds.get(id) ?? []
    const lv = ps.length === 0 ? 0 : Math.max(...ps.map((p) => depth(p, new Set(stack)))) + 1
    memo.set(id, lv)
    return lv
  }
  for (const n of rn) depth(n.id)

  // Group by row (depth level)
  const rowGroups = new Map<number, string[]>()
  for (const n of rn) {
    const r = memo.get(n.id) ?? 0
    if (!rowGroups.has(r)) rowGroups.set(r, [])
    rowGroups.get(r)!.push(n.id)
  }

  // Adjacent to current node (for sort priority within rows)
  const adjacent = new Set<string>()
  for (const l of rl) {
    if (l.source === currentId) adjacent.add(l.target)
    if (l.target === currentId) adjacent.add(l.source)
  }

  // Sort within each row: current → adjacent → rest (stable alphabetical tiebreak)
  for (const ids of rowGroups.values()) {
    ids.sort((a, b) => {
      const pa = a === currentId ? 0 : adjacent.has(a) ? 1 : 2
      const pb = b === currentId ? 0 : adjacent.has(b) ? 1 : 2
      return pa - pb || a.localeCompare(b)
    })
  }

  const sortedRows = [...rowGroups.keys()].sort((a, b) => a - b)
  const rowIdx = new Map(sortedRows.map((r, i) => [r, i]))
  const nRows = sortedRows.length
  const maxCols = Math.max(...[...rowGroups.values()].map((r) => r.length))

  // Canvas size: width by widest row, height by number of rows
  const W = d.PAD * 2 + maxCols * d.NW + (maxCols - 1) * d.CG
  const H = d.PAD * 2 + nRows * d.NH + (nRows - 1) * d.RG

  const rawMap = new Map(rn.map((n) => [n.id, n]))
  const lnodes: LNode[] = []

  for (const [rowLevel, ids] of rowGroups) {
    const ri = rowIdx.get(rowLevel)!
    // Center-align each row horizontally
    const rowW = ids.length * d.NW + (ids.length - 1) * d.CG
    const startX = (W - rowW) / 2

    ids.forEach((id, ci) => {
      lnodes.push({
        ...rawMap.get(id)!,
        x: startX + ci * (d.NW + d.CG),
        y: d.PAD + ri * (d.NH + d.RG),
      })
    })
  }

  const lnMap = new Map(lnodes.map((n) => [n.id, n]))
  const llinks = rl
    .filter((l) => lnMap.has(l.source) && lnMap.has(l.target))
    .map((l) => ({
      id: l.id,
      source: lnMap.get(l.source)!,
      target: lnMap.get(l.target)!,
      skill_label: l.skill_label,
      isActive: l.source === currentId || l.target === currentId,
    }))

  return { nodes: lnodes, links: llinks, W, H }
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

// Cubic bezier from bottom-center of source to top-center of target
function bezierPath(src: LNode, tgt: LNode, NW: number, NH: number): string {
  const x1 = src.x + NW / 2
  const y1 = src.y + NH
  const x2 = tgt.x + NW / 2
  const y2 = tgt.y
  const cy = (y1 + y2) / 2
  return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`
}

// Bevelled octagonal node shape (game skill gem)
function octPath(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r},${y} L${x + w - r},${y} L${x + w},${y + r} L${x + w},${y + h - r} L${x + w - r},${y + h} L${x + r},${y + h} L${x},${y + h - r} L${x},${y + r} Z`
}

function trunc(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

// ── Defs ──────────────────────────────────────────────────────────────────────

function GraphDefs({ uid, variant }: { uid: string; variant: 'inline' | 'modal' }) {
  const c1 = variant === 'modal' ? 'oklch(0.8 0.19 56)' : 'oklch(0.72 0.18 52)'
  const c2 = variant === 'modal' ? 'oklch(0.65 0.22 42)' : 'oklch(0.6 0.2 44)'

  return (
    <defs>
      {/* Vertical gradient for active edges */}
      <linearGradient id={`eg-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={c1} stopOpacity="0.85" />
        <stop offset="100%" stopColor={c2} stopOpacity="0.65" />
      </linearGradient>

      {/* Glow filter for current node in modal */}
      {variant === 'modal' && (
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
    </defs>
  )
}

// ── Edge ──────────────────────────────────────────────────────────────────────

function Edge({
  link, NW, NH, uid, variant,
}: {
  link: LLink; NW: number; NH: number; uid: string; variant: 'inline' | 'modal'
}) {
  const pathD = bezierPath(link.source, link.target, NW, NH)
  const { LFS } = DIM[variant]

  if (!link.isActive) {
    return (
      <path
        d={pathD}
        fill="none"
        stroke={variant === 'modal' ? 'oklch(0.42 0.04 58 / 0.22)' : 'oklch(0.7 0.04 65 / 0.2)'}
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeDasharray="3 5"
      />
    )
  }

  // Badge position: bezier midpoint
  const mx = (link.source.x + link.target.x) / 2 + NW / 2
  const my = (link.source.y + NH + link.target.y) / 2
  const label = link.skill_label
  const badgeW = label.length * LFS * 0.68 + 12
  const badgeH = LFS * 1.7

  return (
    <g>
      {/* Soft glow trail behind active edge */}
      <path
        d={pathD}
        fill="none"
        stroke={variant === 'modal' ? 'oklch(0.78 0.2 55 / 0.28)' : 'oklch(0.7 0.18 52 / 0.22)'}
        strokeWidth={variant === 'modal' ? 5 : 3.5}
        strokeLinecap="round"
      />
      {/* Flowing animated dash — SVG native <animate> avoids CSS keyframes in SVG */}
      <path
        d={pathD}
        fill="none"
        stroke={`url(#eg-${uid})`}
        strokeWidth={variant === 'modal' ? 1.8 : 1.3}
        strokeLinecap="round"
        strokeDasharray="7 5"
        strokeDashoffset="0"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.1s" repeatCount="indefinite" />
      </path>
      {/* Skill label badge at midpoint */}
      {label && (
        <g transform={`translate(${mx - badgeW / 2 + 8},${my - badgeH / 2})`}>
          <rect
            x={0}
            y={0}
            width={badgeW}
            height={badgeH}
            rx={badgeH / 2}
            fill={variant === 'modal' ? 'oklch(0.18 0.04 50 / 0.9)' : 'oklch(0.98 0.02 85 / 0.92)'}
            stroke={variant === 'modal' ? 'oklch(0.72 0.18 52 / 0.45)' : 'oklch(0.72 0.1 52 / 0.3)'}
            strokeWidth={0.7}
          />
          <text
            x={badgeW / 2}
            y={badgeH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={LFS}
            fontWeight={600}
            fill={variant === 'modal' ? 'oklch(0.82 0.14 58)' : 'oklch(0.42 0.14 48)'}
            fontFamily="ui-monospace, monospace"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  )
}

// ── Node ──────────────────────────────────────────────────────────────────────

function Node({
  node, NW, NH, uid, variant, isCurrent, isRelated,
}: {
  node: LNode; NW: number; NH: number; uid: string; variant: 'inline' | 'modal'
  isCurrent: boolean; isRelated: boolean
}) {
  const { FS } = DIM[variant]
  const r = variant === 'modal' ? 6 : 4

  let fill: string
  let stroke: string
  let strokeW: number
  let textFill: string
  let opacity = 1

  if (isCurrent) {
    fill    = variant === 'modal' ? 'oklch(0.72 0.18 52)' : 'oklch(0.82 0.16 52)'
    stroke  = variant === 'modal' ? 'oklch(0.9 0.2 60)'   : 'oklch(0.62 0.2 44)'
    strokeW = 2
    textFill = variant === 'modal' ? 'oklch(0.12 0.02 38)' : 'oklch(0.22 0.06 36)'
  } else if (isRelated) {
    fill    = variant === 'modal' ? 'oklch(0.24 0.07 52)' : 'oklch(0.93 0.07 65)'
    stroke  = variant === 'modal' ? 'oklch(0.6 0.16 50)'  : 'oklch(0.7 0.14 52)'
    strokeW = 1.5
    textFill = variant === 'modal' ? 'oklch(0.88 0.06 75)' : 'oklch(0.36 0.1 46)'
  } else {
    fill    = variant === 'modal' ? 'oklch(0.17 0.03 55)' : 'oklch(0.95 0.015 75)'
    stroke  = variant === 'modal' ? 'oklch(0.3 0.04 58)'  : 'oklch(0.8 0.04 68)'
    strokeW = 1
    textFill = variant === 'modal' ? 'oklch(0.5 0.04 65)' : 'oklch(0.6 0.03 62)'
    opacity  = node.published ? 0.76 : 0.42
  }

  const maxChars = Math.floor((NW - 18) / (FS * 0.62))
  const label = trunc(node.title, maxChars)

  return (
    <g
      opacity={opacity}
      filter={isCurrent && variant === 'modal' ? `url(#glow-${uid})` : undefined}
    >
      <path
        d={octPath(node.x, node.y, NW, NH, r)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
      />
      <text
        x={node.x + NW / 2}
        y={node.y + NH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={FS}
        fontWeight={isCurrent ? 700 : isRelated ? 600 : 500}
        fill={textFill}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {label}
      </text>
      <title>{node.title}</title>
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SkillTreeGraph({
  graph,
  currentRecipeId,
  height = 140,
  variant = 'inline',
}: Props) {
  const uid = useId().replace(/:/g, '')

  // All hooks must run before any conditional return
  const { nodes, links, W, H } = useMemo(
    () => computeLayout(graph, currentRecipeId, variant),
    [graph, currentRecipeId, variant],
  )
  const { NW, NH } = DIM[variant]

  const relatedIds = useMemo(() => {
    const s = new Set<string>()
    for (const l of links) {
      if (l.source.id === currentRecipeId) s.add(l.target.id)
      if (l.target.id === currentRecipeId) s.add(l.source.id)
    }
    return s
  }, [links, currentRecipeId])

  // Modal pan/zoom: update DOM directly, zero React re-renders during drag
  const modalSvgRef = useRef<SVGSVGElement>(null)
  const pzRef = useRef({ x: 0, y: 0, scale: 1 })
  const drag = useRef({ on: false, sx: 0, sy: 0, tx: 0, ty: 0 })

  const applyTransform = useCallback(() => {
    if (!modalSvgRef.current) return
    const { x, y, scale } = pzRef.current
    modalSvgRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (variant !== 'modal') return
      e.preventDefault()
      pzRef.current.scale = Math.min(2.5, Math.max(0.3, pzRef.current.scale * (e.deltaY > 0 ? 0.9 : 1.11)))
      applyTransform()
    },
    [variant, applyTransform],
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (variant !== 'modal') return
      drag.current = { on: true, sx: e.clientX, sy: e.clientY, tx: pzRef.current.x, ty: pzRef.current.y }
    },
    [variant],
  )

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag.current.on) return
    pzRef.current.x = drag.current.tx + e.clientX - drag.current.sx
    pzRef.current.y = drag.current.ty + e.clientY - drag.current.sy
    applyTransform()
  }, [applyTransform])

  const onMouseUp = useCallback(() => {
    drag.current.on = false
  }, [])

  if (graph.nodes.length === 0) {
    return (
      <p
        className="text-[10px]"
        style={{ color: variant === 'modal' ? 'oklch(0.72 0.02 90)' : 'oklch(0.55 0.03 50)' }}
      >
        暂无技能关联数据
      </p>
    )
  }

  const svgContent = (
    <>
      <GraphDefs uid={uid} variant={variant} />
      {/* Render edges first (below nodes) */}
      {links.map((l) => (
        <Edge key={l.id} link={l} NW={NW} NH={NH} uid={uid} variant={variant} />
      ))}
      {/* Nodes on top */}
      {nodes.map((n) => (
        <Node
          key={n.id}
          node={n}
          NW={NW}
          NH={NH}
          uid={uid}
          variant={variant}
          isCurrent={n.id === currentRecipeId}
          isRelated={relatedIds.has(n.id)}
        />
      ))}
    </>
  )

  if (variant === 'inline') {
    return (
      <svg
        viewBox={`0 0 ${W || 1} ${H || 1}`}
        className="w-full"
        style={{ height, maxHeight: height }}
        preserveAspectRatio="xMidYMid meet"
        aria-label="烹饪技能图谱"
      >
        {svgContent}
      </svg>
    )
  }

  return (
    <div
      className="relative w-full select-none overflow-hidden"
      style={{ height, cursor: 'grab' }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        ref={modalSvgRef}
        width={W}
        height={H}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          transformOrigin: '50% 50%',
        }}
        aria-label="烹饪技能全局图谱"
      >
        {svgContent}
      </svg>
    </div>
  )
}
