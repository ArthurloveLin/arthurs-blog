import type { ReactNode } from 'react'

export interface RecipeRevisionPreview {
  id: string
  version: string
  createdAt: string
  changeSummary: string
  hasSnapshot: boolean
  snapshotTitle: string | null
  snapshotCategory: string | null
  leftPage: ReactNode | null
  rightPage: ReactNode | null
}