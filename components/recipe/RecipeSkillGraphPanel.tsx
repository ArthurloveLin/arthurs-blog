'use client'

import dynamic from 'next/dynamic'
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

export default function RecipeSkillGraphPanel({ currentRecipeId, mutedStyle }: Props) {
  const { graph, connectedRecipeIds, hasMultipleNodes } = useRecipeSkillGraph()
  const hasSkillLinks = connectedRecipeIds.has(currentRecipeId) || hasMultipleNodes

  if (!hasSkillLinks) {
    return null
  }

  return (
    <div>
      <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
        技能图谱
      </p>
      <SkillTreeGraph graph={graph} currentRecipeId={currentRecipeId} />
    </div>
  )
}