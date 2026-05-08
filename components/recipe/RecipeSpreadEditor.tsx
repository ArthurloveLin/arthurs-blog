'use client'

import { useEffect, useState } from 'react'
import type { Recipe } from '@/lib/recipes'
import { useRecipeEditor } from '@/hooks/useRecipeEditor'
import RecipeSpreadSkeleton from './RecipeSpreadSkeleton'
import RecipeEditBookmarks from './RecipeEditBookmarks'
import RecipeEditLeftPage from './RecipeEditLeftPage'
import RecipeEditRightPage from './RecipeEditRightPage'

interface Props {
  slug: string
  onCancel: () => void
  onSaved: () => void
}

function RecipeEditorContent({ recipe, onCancel, onSaved }: { recipe: Recipe; onCancel: () => void; onSaved: () => void }) {
  const editor = useRecipeEditor({ recipe, onSaved })

  return (
    <div className="bs-carousel-item">
      <div className="bs-page-container" data-motion="anchored">
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
            onCancel={onCancel}
            error={editor.error}
          />
        </div>
      </div>
    </div>
  )
}

export default function RecipeSpreadEditor({ slug, onCancel, onSaved }: Props) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadRecipe() {
      try {
        setError(null)
        const response = await fetch(`/api/recipes/${slug}`)
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(typeof payload?.error === 'string' ? payload.error : `HTTP ${response.status}`)
        }

        const data = (await response.json()) as Recipe
        if (isActive) {
          setRecipe(data)
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      }
    }

    void loadRecipe()

    return () => {
      isActive = false
    }
  }, [slug])

  if (error) {
    return (
      <div className="bs-carousel-item">
        <div className="bs-page-container" data-motion="anchored">
          <div className="bs-left-page flex items-center justify-center text-xs text-amber-900/60">
            {error}
          </div>
          <div className="bs-right-page">
            <div className="bs-right-page-scroll" />
            <RecipeEditBookmarks isSaving={false} onSave={() => {}} onCancel={onCancel} error={error} />
          </div>
        </div>
      </div>
    )
  }

  if (!recipe) {
    return <RecipeSpreadSkeleton />
  }

  return <RecipeEditorContent recipe={recipe} onCancel={onCancel} onSaved={onSaved} />
}