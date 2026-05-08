'use client'

import { useEffect, useState } from 'react'
import type { Recipe } from '@/lib/recipes'
import { useRecipeEditor } from '@/hooks/useRecipeEditor'
import BookSpread from './BookSpread'
import RecipeSpreadSkeleton from './RecipeSpreadSkeleton'
import RecipeEditBookmarks from './RecipeEditBookmarks'
import RecipeEditLeftPage from './RecipeEditLeftPage'
import RecipeEditRightPage from './RecipeEditRightPage'

interface Props {
  slug: string
  onCancel: () => void
  onSaved: () => void
  onDelete: () => void
}

function RecipeEditorContent({ recipe, onCancel, onSaved, onDelete }: { recipe: Recipe; onCancel: () => void; onSaved: () => void; onDelete: () => void }) {
  const editor = useRecipeEditor({ recipe, onSaved })

  return (
    <BookSpread
      left={<RecipeEditLeftPage editor={editor} />}
      right={<RecipeEditRightPage editor={editor} />}
      rightOverlay={
        <RecipeEditBookmarks
          isSaving={editor.isSaving}
          onSave={editor.save}
          onCancel={onCancel}
          onDelete={onDelete}
          error={editor.error}
        />
      }
    />
  )
}

export default function RecipeSpreadEditor({ slug, onCancel, onSaved, onDelete }: Props) {
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
      <BookSpread
        left={<div className="flex items-center justify-center text-xs text-amber-900/60">{error}</div>}
        right={<div />}
        rightOverlay={
          <RecipeEditBookmarks isSaving={false} onSave={() => {}} onCancel={onCancel} onDelete={onDelete} error={error} />
        }
      />
    )
  }

  if (!recipe) {
    return <RecipeSpreadSkeleton />
  }

  return <RecipeEditorContent recipe={recipe} onCancel={onCancel} onSaved={onSaved} onDelete={onDelete} />
}