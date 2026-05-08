'use client'

import { useState } from 'react'
import type { Recipe, RecipeRevision, SkillGraphData } from '@/lib/recipes'
import { useAuth } from '@/components/AuthProvider'
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

export default function RecipeSpreadClient({ recipe, revisions, skillGraph }: Props) {
  const { isAdmin } = useAuth()
  const [showRevisions, setShowRevisions] = useState(false)

  const editor = useRecipeEditor({ recipe })
  const { togglePublish } = editor

  if (editor.isEditing) {
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
            {isAdmin && (
              <RecipeEditBookmarks
                isSaving={editor.isSaving}
                onSave={editor.save}
                onCancel={editor.cancelEditing}
                error={editor.error}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <BookSpread
      left={
        <RecipeLeftPage
          recipe={recipe}
          revisions={showRevisions ? revisions : revisions.slice(0, 3)}
        />
      }
      right={<RecipeRightPage recipe={recipe} skillGraph={skillGraph} />}
      rightOverlay={
        isAdmin && (
          <RecipeViewBookmarks
            isPublished={recipe.published}
            onEdit={editor.startEditing}
            onViewRevisions={() => setShowRevisions((v) => !v)}
            onTogglePublish={togglePublish}
          />
        )
      }
    />
  )
}
