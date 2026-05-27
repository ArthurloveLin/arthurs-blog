import { Bodoni_Moda, IBM_Plex_Mono } from 'next/font/google'

export const calorieDisplayFont = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-calorie-display',
  display: 'swap',
  weight: ['400', '500', '700'],
})

export const calorieMonoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-calorie-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export interface NutritionTotals {
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
}

export interface DayMealItem extends Partial<NutritionTotals> {
  id?: string
  food_name: string
  quantity_text?: string | null
  grams?: number | null
  estimate_level?: string
  confidence_score?: number | null
  needs_review?: boolean
}

export interface DayMeal {
  id: string
  meal_type: string
  meal_label: string | null
  occurred_at: string | null
  totals: NutritionTotals
  items: DayMealItem[]
}

export interface DayResponse {
  date: string
  dayLog: {
    id: string
    target_calories: number
    target_protein_g: number
    target_gap_min: number
    target_gap_max: number
    notes?: string | null
    status?: string
  } | null
  totals: NutritionTotals
  meals: DayMeal[]
  summary: {
    mealCount: number
    entryCount: number
    reviewedEntryCount: number
  }
}

export interface ReportDayItem {
  date: string
  totals: NutritionTotals
  targets: {
    calories: number
    protein_g: number
    gap_min: number
    gap_max: number
  }
}

export interface ReportResponse {
  period: 'day' | 'week' | 'month'
  anchor: string
  dateRange: {
    start: string
    end: string
  }
  totals: NutritionTotals
  estimateRatio: number
  days: ReportDayItem[]
  sourceSummary: Array<{
    sourceKind: string
    entries: number
    calories: number
  }>
  insights: string[]
}

export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function requestJson<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export interface CalorieDraftItem {
  food_name: string
  food_alias?: string | null
  quantity_text?: string | null
  grams?: number | null
  calories?: number | null
  protein_g?: number | null
  fat_g?: number | null
  carbs_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
  estimate_level: 'confirmed' | 'database' | 'estimated'
  source_kind: 'agent' | 'knowledge_db' | 'reference_override' | 'ocr' | 'manual'
  confidence_score?: number | null
  needs_review?: boolean
}

export interface CalorieDraftMeal {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'custom'
  meal_label?: string | null
  occurred_at?: string | null
  items: CalorieDraftItem[]
}

export interface CalorieDraftPayload {
  schemaVersion: 'calorie-draft-v1'
  date: string | null
  summary: string
  insights: string[]
  totals: Partial<NutritionTotals>
  meals: CalorieDraftMeal[]
}

export async function deleteWorkspace(id: string) {
  const response = await fetch(`/api/calorie/workspaces/${id}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? `Delete failed: ${response.status}`)
  }
}

export async function discardRun(id: string) {
  const response = await fetch(`/api/calorie/runs/${id}/discard`, { method: 'POST' })
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? `Discard failed: ${response.status}`)
  }
}

export async function commitRun(id: string, editedPayload?: CalorieDraftPayload | null): Promise<DayResponse> {
  return requestJson<DayResponse>(`/api/calorie/runs/${id}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editedPayload ? { editedPayload } : {}),
  })
}

export async function deleteMeal(id: string): Promise<{ date: string }> {
  return requestJson<{ date: string }>(`/api/calorie/meals/${id}`, { method: 'DELETE' })
}

export function formatTime(value: string | null | undefined) {
  if (!value) {
    return '未记录时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(digits)
}

export function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return new Intl.NumberFormat('zh-CN', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value)
}

export function formatMealTitle(meal: { meal_type: string; meal_label?: string | null }) {
  const base = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    snack: '加餐',
    custom: '自定义',
  }[meal.meal_type] ?? meal.meal_type

  return meal.meal_label?.trim() ? `${base} · ${meal.meal_label.trim()}` : base
}

export function normalizeNutritionTotals(input?: Partial<NutritionTotals> | null): NutritionTotals {
  return {
    calories: typeof input?.calories === 'number' ? input.calories : 0,
    protein_g: typeof input?.protein_g === 'number' ? input.protein_g : 0,
    fat_g: typeof input?.fat_g === 'number' ? input.fat_g : 0,
    carbs_g: typeof input?.carbs_g === 'number' ? input.carbs_g : 0,
    fiber_g: typeof input?.fiber_g === 'number' ? input.fiber_g : 0,
    sugar_g: typeof input?.sugar_g === 'number' ? input.sugar_g : 0,
    sodium_mg: typeof input?.sodium_mg === 'number' ? input.sodium_mg : 0,
  }
}