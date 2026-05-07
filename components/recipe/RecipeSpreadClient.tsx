'use client'

import { useState } from 'react'
import type { Recipe, RecipeRevision, SkillGraphData } from '@/lib/recipes'
import { useAuth } from '@/components/AuthProvider'
import { useRecipeEditor } from '@/hooks/useRecipeEditor'
import BookSpread from './BookSpread'
import RecipeLeftPage from './RecipeLeftPage'
import RecipeRightPage from './RecipeRightPage'
import RecipeBookmarks from './RecipeBookmarks'
import RecipeEditForm from './RecipeEditForm'

interface Props {
  recipe: Recipe
  revisions: RecipeRevision[]
  skillGraph: SkillGraphData
}

export default function RecipeSpreadClient({ recipe, revisions, skillGraph }: Props) {
  const { isAdmin } = useAuth()
  const [showRevisions, setShowRevisions] = useState(false)

  const editor = useRecipeEditor({ recipe })

  async function togglePublish() {
    const res = await fetch(`/api/recipes/${recipe.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !recipe.published }),
    })
    if (res.ok) window.location.reload()
  }

  if (editor.isEditing) {
    return (
      <div className="bs-carousel-item">
        <div className="bs-page-container">
          <div className="bs-left-page">
            <RecipeEditForm editor={editor} side="left" />
          </div>
          <div className="bs-right-page relative">
            <RecipeEditForm editor={editor} side="right" />
            {/* Bookmarks in edit mode */}
            <div className="absolute top-2 right-2">
              <RecipeBookmarks
                isAdmin={isAdmin}
                isEditing
                isSaving={editor.isSaving}
                isPublished={recipe.published}
                onEdit={editor.startEditing}
                onCancel={editor.cancelEditing}
                onSave={editor.save}
                onTogglePublish={togglePublish}
                onViewRevisions={() => setShowRevisions((v) => !v)}
                error={editor.error}
              />
            </div>
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
      right={
        <div className="relative h-full">
          <RecipeRightPage recipe={recipe} skillGraph={skillGraph} />
          {isAdmin && (
            <div className="absolute top-2 right-2">
              <RecipeBookmarks
                isAdmin
                isEditing={false}
                isSaving={false}
                isPublished={recipe.published}
                onEdit={editor.startEditing}
                onCancel={editor.cancelEditing}
                onSave={editor.save}
                onTogglePublish={togglePublish}
                onViewRevisions={() => setShowRevisions((v) => !v)}
                error={null}
              />
            </div>
          )}
        </div>
      }
    />
  )
}
