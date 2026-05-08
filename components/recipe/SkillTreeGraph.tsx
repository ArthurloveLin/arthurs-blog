'use client'

import { useEffect, useId, useRef } from 'react'
import type { SkillGraphData } from '@/lib/recipes'
import * as d3 from 'd3'

interface Props {
  graph: SkillGraphData
  currentRecipeId: string
  height?: number
  variant?: 'inline' | 'modal'
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  slug: string
  title: string
  published: boolean
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  skill_label: string
}

function getNodeId(node: string | SimNode) {
  return typeof node === 'string' ? node : node.id
}

function truncateTitle(title: string, maxLength: number) {
  if (title.length <= maxLength) {
    return title
  }

  return `${title.slice(0, maxLength - 1)}…`
}

export default function SkillTreeGraph({ graph, currentRecipeId, height = 140, variant = 'inline' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const markerId = useId().replace(/:/g, '')

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || graph.nodes.length === 0) return

    const W = svg.clientWidth || (variant === 'modal' ? 880 : 260)
    const H = height
    const palette = variant === 'modal'
      ? {
          nodeText: 'oklch(0.94 0.01 95)',
          nodeTextMuted: 'oklch(0.84 0.02 85 / 0.75)',
          nodeStroke: 'oklch(0.12 0.01 80)',
          nodeFill: 'oklch(0.43 0.04 75 / 0.95)',
          currentFill: 'oklch(0.72 0.16 45)',
          relatedFill: 'oklch(0.82 0.13 60)',
          link: 'oklch(0.88 0.08 70 / 0.3)',
          currentLink: 'oklch(0.8 0.16 52 / 0.9)',
          label: 'oklch(0.96 0.02 95)',
          labelBg: 'oklch(0.26 0.02 60 / 0.82)',
        }
      : {
          nodeText: 'oklch(0.35 0.03 50)',
          nodeTextMuted: 'oklch(0.45 0.02 55 / 0.6)',
          nodeStroke: 'oklch(0.97 0.02 85)',
          nodeFill: 'oklch(0.72 0.02 70)',
          currentFill: 'oklch(0.65 0.18 35)',
          relatedFill: 'oklch(0.78 0.12 35)',
          link: 'oklch(0.65 0.1 40 / 0.18)',
          currentLink: 'oklch(0.65 0.18 35 / 0.65)',
          label: 'oklch(0.38 0.04 42)',
          labelBg: 'oklch(0.98 0.01 90 / 0.88)',
        }

    d3.select(svg).selectAll('*').remove()

    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }))
    const links: SimLink[] = graph.links.map((l) => ({ ...l }))
    const relatedNodeIds = new Set<string>([currentRecipeId])

    for (const link of links) {
      const sourceId = String(link.source)
      const targetId = String(link.target)

      if (sourceId === currentRecipeId) {
        relatedNodeIds.add(targetId)
      }

      if (targetId === currentRecipeId) {
        relatedNodeIds.add(sourceId)
      }
    }

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((link) => {
            const sourceId = getNodeId(link.source)
            const targetId = getNodeId(link.target)

            return sourceId === currentRecipeId || targetId === currentRecipeId ? 120 : 165
          })
          .strength((link) => {
            const sourceId = getNodeId(link.source)
            const targetId = getNodeId(link.target)

            return sourceId === currentRecipeId || targetId === currentRecipeId ? 0.3 : 0.12
          })
      )
      .force('charge', d3.forceManyBody().strength(variant === 'modal' ? -260 : -120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(variant === 'modal' ? 34 : 22))

    simulation.stop()
    for (let tick = 0; tick < (variant === 'modal' ? 220 : 140); tick += 1) {
      simulation.tick()
    }

    const root = d3.select(svg)
    const zoomLayer = root.append('g')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(variant === 'modal' ? [0.55, 2.6] : [0.9, 1.8])
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform.toString())
      })

    root.call(zoom)
    root.on('dblclick.zoom', null)

    // Arrow marker
    root
      .append('defs')
      .append('marker')
      .attr('id', `arrowhead-${markerId}`)
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', variant === 'modal' ? 20 : 14)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', palette.currentLink)
      .attr('opacity', 0.9)

    const linkGroup = zoomLayer
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (link) => {
        const sourceId = getNodeId(link.source)
        const targetId = getNodeId(link.target)
        return sourceId === currentRecipeId || targetId === currentRecipeId ? palette.currentLink : palette.link
      })
      .attr('stroke-opacity', (link) => {
        const sourceId = getNodeId(link.source)
        const targetId = getNodeId(link.target)
        return sourceId === currentRecipeId || targetId === currentRecipeId ? 0.95 : 0.7
      })
      .attr('stroke-width', (link) => {
        const sourceId = getNodeId(link.source)
        const targetId = getNodeId(link.target)
        return sourceId === currentRecipeId || targetId === currentRecipeId ? 2 : 1.1
      })
      .attr('marker-end', `url(#arrowhead-${markerId})`)

    const labelLinks = links.filter((link) => {
      const sourceId = getNodeId(link.source)
      const targetId = getNodeId(link.target)
      return sourceId === currentRecipeId || targetId === currentRecipeId
    })

    const labelGroup = zoomLayer.append('g')

    const labelBackgrounds = labelGroup
      .selectAll('rect')
      .data(labelLinks)
      .join('rect')
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', palette.labelBg)
      .attr('stroke', 'none')

    const labelTexts = labelGroup
      .selectAll('text')
      .data(labelLinks)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', variant === 'modal' ? 11 : 8)
      .attr('font-weight', 600)
      .attr('fill', palette.label)
      .text((link) => link.skill_label)

    const nodeGroup = zoomLayer
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', variant === 'modal' ? 'grab' : 'default')

    nodeGroup
      .append('circle')
      .attr('r', (d) => {
        if (d.id === currentRecipeId) {
          return variant === 'modal' ? 18 : 10
        }

        if (relatedNodeIds.has(d.id)) {
          return variant === 'modal' ? 11 : 7
        }

        return variant === 'modal' ? 8 : 5
      })
      .attr('fill', (d) => {
        if (d.id === currentRecipeId) {
          return palette.currentFill
        }

        if (relatedNodeIds.has(d.id)) {
          return palette.relatedFill
        }

        return d.published ? palette.nodeFill : 'oklch(0.58 0.01 60 / 0.8)'
      })
      .attr('opacity', (d) => (relatedNodeIds.has(d.id) ? 1 : 0.74))
      .attr('stroke', palette.nodeStroke)
      .attr('stroke-width', (d) => (d.id === currentRecipeId ? 3 : relatedNodeIds.has(d.id) ? 2 : 1.4))

    nodeGroup
      .append('title')
      .text((d) => d.title)

    nodeGroup
      .append('text')
      .attr('dy', (d) => {
        if (d.id === currentRecipeId) {
          return variant === 'modal' ? 28 : 17
        }

        return variant === 'modal' ? 22 : 14
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', (d) => {
        if (d.id === currentRecipeId) {
          return variant === 'modal' ? 12 : 8
        }

        return variant === 'modal' ? 10 : 7
      })
      .attr('font-weight', (d) => (d.id === currentRecipeId ? 700 : relatedNodeIds.has(d.id) ? 600 : 500))
      .attr('fill', (d) => (relatedNodeIds.has(d.id) ? palette.nodeText : palette.nodeTextMuted))
      .text((d) => truncateTitle(d.title, variant === 'modal' ? 12 : 7))

    linkGroup
      .attr('x1', (d) => (d.source as SimNode).x ?? 0)
      .attr('y1', (d) => (d.source as SimNode).y ?? 0)
      .attr('x2', (d) => (d.target as SimNode).x ?? 0)
      .attr('y2', (d) => (d.target as SimNode).y ?? 0)

    labelTexts
      .attr('x', (d) => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
      .attr('y', (d) => ((((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2) - (variant === 'modal' ? 14 : 9))

    labelBackgrounds.each(function eachLabelBackground(d) {
      const textNode = labelTexts.filter((label) => label === d).node()
      if (!textNode) {
        return
      }

      const bounds = textNode.getBBox()

      d3.select(this)
        .attr('x', bounds.x - 6)
        .attr('y', bounds.y - 3)
        .attr('width', bounds.width + 12)
        .attr('height', bounds.height + 6)
    })

    nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

    const graphBounds = zoomLayer.node()?.getBBox()
    if (graphBounds && graphBounds.width > 0 && graphBounds.height > 0) {
      const maxScale = variant === 'modal' ? 1.18 : 1.05
      const scale = Math.min(
        maxScale,
        0.88 / Math.max(graphBounds.width / W, graphBounds.height / H, 0.0001)
      )
      const tx = W / 2 - scale * (graphBounds.x + graphBounds.width / 2)
      const ty = H / 2 - scale * (graphBounds.y + graphBounds.height / 2)
      const transform = d3.zoomIdentity.translate(tx, ty).scale(scale)

      root.call(zoom.transform, transform)
    }

    return () => {
      simulation.stop()
    }
  }, [currentRecipeId, graph, height, markerId, variant])

  if (graph.nodes.length === 0) {
    return (
      <p className="text-[10px]" style={{ color: variant === 'modal' ? 'oklch(0.82 0.02 90)' : 'oklch(0.55 0.03 50)' }}>
        暂无技能关联数据
      </p>
    )
  }

  return (
    <svg
      ref={svgRef}
      className="w-full"
      style={{ height, background: 'transparent' }}
      aria-label={variant === 'modal' ? '烹饪技能全局图谱' : '烹饪技能图谱'}
    />
  )
}
