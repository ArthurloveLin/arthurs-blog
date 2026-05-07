'use client'

import { useRef, useEffect } from 'react'
import type { SkillGraphData } from '@/lib/recipes'
import * as d3 from 'd3'

interface Props {
  graph: SkillGraphData
  currentRecipeId: string
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

export default function SkillTreeGraph({ graph, currentRecipeId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || graph.nodes.length === 0) return

    const W = svg.clientWidth || 200
    const H = svg.clientHeight || 140

    d3.select(svg).selectAll('*').remove()

    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }))
    const links: SimLink[] = graph.links.map((l) => ({ ...l }))

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(50)
      )
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(18))

    const root = d3.select(svg)

    // Arrow marker
    root
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 14)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', 'oklch(0.65 0.18 35)')
      .attr('opacity', 0.7)

    const linkGroup = root
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'oklch(0.65 0.18 35)')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrowhead)')

    const nodeGroup = root
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')

    nodeGroup
      .append('circle')
      .attr('r', (d) => (d.id === currentRecipeId ? 8 : 5))
      .attr('fill', (d) =>
        d.id === currentRecipeId
          ? 'oklch(0.65 0.18 35)'
          : d.published
          ? 'oklch(0.78 0.12 35)'
          : 'oklch(0.7 0.02 50)'
      )
      .attr('stroke', 'oklch(0.97 0.02 85)')
      .attr('stroke-width', 1.5)

    nodeGroup
      .append('text')
      .attr('dy', 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', 'oklch(0.35 0.03 50)')
      .text((d) => (d.title.length > 6 ? d.title.slice(0, 5) + '…' : d.title))

    simulation.on('tick', () => {
      linkGroup
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
    }
  }, [graph, currentRecipeId])

  if (graph.nodes.length === 0) {
    return (
      <p className="text-[10px]" style={{ color: 'oklch(0.55 0.03 50)' }}>
        暂无技能关联数据
      </p>
    )
  }

  return (
    <svg
      ref={svgRef}
      className="w-full"
      style={{ height: 140, background: 'transparent' }}
      aria-label="烹饪技能图谱"
    />
  )
}
