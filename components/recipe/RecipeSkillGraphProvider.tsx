'use client'

import { createContext, useContext, useMemo } from 'react'
import type { SkillGraphData } from '@/lib/recipes'

interface RecipeSkillGraphContextValue {
  graph: SkillGraphData
  connectedRecipeIds: Set<string>
  hasMultipleNodes: boolean
}

const RecipeSkillGraphContext = createContext<RecipeSkillGraphContextValue | null>(null)

interface RecipeSkillGraphProviderProps {
  graph: SkillGraphData
  children: React.ReactNode
}

export function RecipeSkillGraphProvider({ graph, children }: RecipeSkillGraphProviderProps) {
  const value = useMemo<RecipeSkillGraphContextValue>(() => {
    const connectedRecipeIds = new Set<string>()

    for (const link of graph.links) {
      connectedRecipeIds.add(String(link.source))
      connectedRecipeIds.add(String(link.target))
    }

    return {
      graph,
      connectedRecipeIds,
      hasMultipleNodes: graph.nodes.length > 1,
    }
  }, [graph])

  return (
    <RecipeSkillGraphContext.Provider value={value}>
      {children}
    </RecipeSkillGraphContext.Provider>
  )
}

export function useRecipeSkillGraph() {
  const value = useContext(RecipeSkillGraphContext)

  if (!value) {
    throw new Error('useRecipeSkillGraph must be used within RecipeSkillGraphProvider')
  }

  return value
}