'use client'

import { useState, useCallback, useTransition } from 'react'
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
  const [isRefreshPending, startTransition] = useTransition()
  const [changeSummary, setChangeSummary] = useState('')
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

  const setField = useCallback(<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addIngredient = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { id: crypto.randomUUID(), amount: '', unit: '', name: '', note: '' } satisfies Ingredient,
      ],
    }))
  }, [])

  const removeIngredient = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== id),
    }))
  }, [])

  const updateIngredient = useCallback((id: string, patch: Partial<Ingredient>) => {
    setDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)),
    }))
  }, [])

  const addStep = useCallback(() => {
    setDraft((prev) => {
      const nextOrder = (prev.steps.at(-1)?.order ?? 0) + 1
      return {
        ...prev,
        steps: [
          ...prev.steps,
          { id: crypto.randomUUID(), order: nextOrder, title: '', description: '', tip: '' } satisfies RecipeStep,
        ],
      }
    })
  }, [])

  const removeStep = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== id),
    }))
  }, [])

  const updateStep = useCallback((id: string, patch: Partial<RecipeStep>) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }, [])

  const save = useCallback(async () => {
    const normalizedVersion = draft.version.trim()
    const versionChanged = normalizedVersion !== recipe.version

    if (!normalizedVersion) {
      setError('版本号不能为空')
      return
    }

    if (versionChanged && !changeSummary.trim()) {
      setError('修改版本号时需要填写本次变更说明')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/recipes/${recipe.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          version: normalizedVersion,
          change_summary: versionChanged ? changeSummary.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setIsEditing(false)
      setChangeSummary('')
      startTransition(() => {
        router.refresh()
        onSaved?.()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [changeSummary, draft, onSaved, recipe.slug, recipe.version, router, startTransition])

  return {
    isEditing,
    isSaving: isSaving || isRefreshPending,
    error,
    draft,
    changeSummary,
    originalVersion: recipe.version,
    versionChanged: draft.version.trim() !== recipe.version,
    startEditing,
    cancelEditing,
    setField,
    setChangeSummary,
    save,
    ingredientActions: { addIngredient, removeIngredient, updateIngredient },
    stepActions: { addStep, removeStep, updateStep },
  }
}
