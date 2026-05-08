'use client'

import { useState } from 'react'
import type { Recipe, RecipeRevision, SkillGraphData } from '@/lib/recipes'
import { useRecipeEditor } from '@/hooks/useRecipeEditor'
import BookSpread from './BookSpread'
import RecipeLeftPage from './RecipeLeftPage'
import RecipeRightPage from './RecipeRightPage'
import RecipeViewBookmarks from './RecipeViewBookmarks'
import RecipeEditBookmarks from './RecipeEditBookmarks'
import RecipeEditLeftPage from './RecipeEditLeftPage'
import RecipeEditRightPage from './RecipeEditRightPage'

interface Props {
  recipe: Recipe
  revisions: RecipeRevision[]
  skillGraph: SkillGraphData
}

type RecipeEditor = ReturnType<typeof useRecipeEditor>

function RecipeEditingSpread({ editor }: { editor: RecipeEditor }) {
  return (
    <div className="bs-carousel-item">
      <div className="bs-page-container">
        <div className="bs-left-page">
          <RecipeEditLeftPage editor={editor} />
        </div>
        <div className="bs-right-page">
          <div className="bs-right-page-scroll">
            <RecipeEditRightPage editor={editor} />
          </div>
          <RecipeEditBookmarks
            isSaving={editor.isSaving}
            onSave={editor.save}
            onCancel={editor.cancelEditing}
            error={editor.error}
          />
        </div>
      </div>
    </div>
  )
}

interface RecipeViewingSpreadProps extends Props {
  onEdit: () => void
  onTogglePublish: () => void
  showAllRevisions: boolean
  onToggleRevisions: () => void
}

function RecipeViewingSpread({
  recipe,
  revisions,
  skillGraph,
  onEdit,
  onTogglePublish,
  showAllRevisions,
  onToggleRevisions,
}: RecipeViewingSpreadProps) {
  const visibleRevisions = showAllRevisions ? revisions : revisions.slice(0, 3)

  return (
    <BookSpread
      left={<RecipeLeftPage recipe={recipe} revisions={visibleRevisions} />}
      right={<RecipeRightPage recipe={recipe} skillGraph={skillGraph} />}
      rightOverlay={
        <RecipeViewBookmarks
          isPublished={recipe.published}
          onEdit={onEdit}
          onViewRevisions={onToggleRevisions}
          onTogglePublish={onTogglePublish}
        />
      }
    />
  )
}

export default function RecipeSpreadClient({ recipe, revisions, skillGraph }: Props) {
  const [showAllRevisions, setShowAllRevisions] = useState(false)

  const editor = useRecipeEditor({ recipe })
  const { togglePublish } = editor

  if (editor.isEditing) {
    return <RecipeEditingSpread editor={editor} />
  }

  return (
    <RecipeViewingSpread
      recipe={recipe}
      revisions={revisions}
      skillGraph={skillGraph}
      onEdit={editor.startEditing}
      onTogglePublish={togglePublish}
      showAllRevisions={showAllRevisions}
      onToggleRevisions={() => setShowAllRevisions((value) => !value)}
    />
  )
}
