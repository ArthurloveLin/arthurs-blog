import 'server-only'

import type {
  CalorieDraftPayload,
  CalorieEntryDraft,
  CalorieMealDraft,
  CalorieNutritionDraft,
} from '@/lib/agent-runtime/contracts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  throw new Error(`Expected nullable number, received ${String(value)}`)
}

function asString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }

  return value.trim()
}

function asOptionalString(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`Expected optional string, received ${String(value)}`)
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseNutritionDraft(value: unknown): CalorieNutritionDraft {
  const raw = isRecord(value) ? value : {}

  return {
    calories: asNullableNumber(raw.calories),
    protein_g: asNullableNumber(raw.protein_g),
    fat_g: asNullableNumber(raw.fat_g),
    carbs_g: asNullableNumber(raw.carbs_g),
    fiber_g: asNullableNumber(raw.fiber_g),
    sugar_g: asNullableNumber(raw.sugar_g),
    sodium_mg: asNullableNumber(raw.sodium_mg),
  }
}

function parseEntryDraft(value: unknown): CalorieEntryDraft {
  if (!isRecord(value)) {
    throw new Error('Meal item must be an object')
  }

  const estimateLevel = asString(value.estimate_level, 'estimate_level')
  const sourceKind = asString(value.source_kind, 'source_kind')

  if (!['confirmed', 'database', 'estimated'].includes(estimateLevel)) {
    throw new Error(`Unsupported estimate_level: ${estimateLevel}`)
  }

  if (!['agent', 'knowledge_db', 'reference_override', 'ocr', 'manual'].includes(sourceKind)) {
    throw new Error(`Unsupported source_kind: ${sourceKind}`)
  }

  return {
    ...parseNutritionDraft(value),
    food_name: asString(value.food_name, 'food_name'),
    food_alias: asOptionalString(value.food_alias),
    quantity_text: asOptionalString(value.quantity_text),
    grams: asNullableNumber(value.grams),
    estimate_level: estimateLevel as CalorieEntryDraft['estimate_level'],
    source_kind: sourceKind as CalorieEntryDraft['source_kind'],
    confidence_score: asNullableNumber(value.confidence_score),
    needs_review: typeof value.needs_review === 'boolean' ? value.needs_review : true,
    source_ref: isRecord(value.source_ref) ? value.source_ref : {},
  }
}

function parseMealDraft(value: unknown): CalorieMealDraft {
  if (!isRecord(value)) {
    throw new Error('Meal must be an object')
  }

  const mealType = asString(value.meal_type, 'meal_type')
  if (!['breakfast', 'lunch', 'dinner', 'snack', 'custom'].includes(mealType)) {
    throw new Error(`Unsupported meal_type: ${mealType}`)
  }

  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new Error('Meal.items must be a non-empty array')
  }

  return {
    meal_type: mealType as CalorieMealDraft['meal_type'],
    meal_label: asOptionalString(value.meal_label),
    occurred_at: asOptionalString(value.occurred_at),
    items: value.items.map((item) => parseEntryDraft(item)),
  }
}

export function validateCalorieDraftPayload(value: unknown): CalorieDraftPayload {
  if (!isRecord(value)) {
    throw new Error('Draft payload must be an object')
  }

  const schemaVersion = asString(value.schemaVersion, 'schemaVersion')
  if (schemaVersion !== 'calorie-draft-v1') {
    throw new Error(`Unsupported schemaVersion: ${schemaVersion}`)
  }

  const meals = Array.isArray(value.meals) ? value.meals.map((meal) => parseMealDraft(meal)) : []
  if (meals.length === 0) {
    throw new Error('Draft payload must contain at least one meal')
  }

  return {
    schemaVersion: 'calorie-draft-v1',
    date: asOptionalString(value.date),
    summary: asString(value.summary, 'summary'),
    insights: Array.isArray(value.insights)
      ? value.insights.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [],
    totals: parseNutritionDraft(value.totals),
    meals,
  }
}

export function extractJsonObjectFromText(rawText: string) {
  const trimmed = rawText.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in agent output')
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown
}