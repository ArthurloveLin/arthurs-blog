'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Recipe, Ingredient, RecipeStep } from '@/lib/recipes'

export type RecipeDraft = Omit<Recipe, 'id' | 'created_at' | 'updated_at'>

interface UseRecipeEditorOptions {
  recipe: Recipe
  onSaved?: () => void
}

export function useRecipeEditor({ recipe, onSaved }: UseRecipeEditorOptions) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<RecipeDraft>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = recipe
    return rest
  })

  const startEditing = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = recipe
    setDraft(rest)
    setError(null)
    setIsEditing(true)
  }, [recipe])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setError(null)
  }, [])

  function setField<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function addIngredient() {
    setDraft((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { id: crypto.randomUUID(), amount: '', unit: '', name: '', note: '' } satisfies Ingredient,
      ],
    }))
  }

  function removeIngredient(id: string) {
    setDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== id),
    }))
  }

  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    setDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)),
    }))
  }

  function addStep() {
    const nextOrder = (draft.steps.at(-1)?.order ?? 0) + 1
    setDraft((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { id: crypto.randomUUID(), order: nextOrder, title: '', description: '', tip: '' } satisfies RecipeStep,
      ],
    }))
  }

  function removeStep(id: string) {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== id),
    }))
  }

  function updateStep(id: string, patch: Partial<RecipeStep>) {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }

  const save = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/recipes/${recipe.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setIsEditing(false)
      router.refresh()
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [recipe.slug, draft, router, onSaved])

  return {
    isEditing,
    isSaving,
    error,
    draft,
    startEditing,
    cancelEditing,
    setField,
    save,
    ingredientActions: { addIngredient, removeIngredient, updateIngredient },
    stepActions: { addStep, removeStep, updateStep },
  }
}
