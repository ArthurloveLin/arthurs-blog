import 'server-only'

import { revalidateTag } from 'next/cache'

import { validateCalorieDraftPayload } from '@/lib/agent-runtime/validation'
import type { CalorieDraftPayload } from '@/lib/agent-runtime/contracts'
import { executeAgentRunForOwner, createAgentMessageForOwner, createAgentThreadForOwner, getAgentRunDetailOrThrow, getAgentThreadBundleOrThrow, listAgentThreadsForOwner } from '@/lib/agent-runtime/service'
import { AppError } from '@/lib/app-error'
import { CALORIE_CACHE_TAGS, getCalorieDayTag, getCalorieWorkspaceTag } from '@/lib/calorie/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'

type JsonRecord = Record<string, unknown>
type CalorieReportPeriod = 'day' | 'week' | 'month'

interface CalorieDayLogRecord {
  id: string
  owner_user_id: string
  log_date: string
  target_calories: number
  target_protein_g: number
  target_gap_min: number
  target_gap_max: number
  status: string
  notes: string | null
  metadata: JsonRecord
  latest_summary_run_id: string | null
  created_at: string
  updated_at: string
}

interface CalorieMealRecord {
  id: string
  day_log_id: string
  meal_type: string
  meal_label: string | null
  occurred_at: string | null
  source_thread_id: string | null
  source_message_id: string | null
  metadata: JsonRecord
  created_at: string
  updated_at: string
}

interface CalorieEntryRecord {
  id: string
  meal_id: string
  food_name: string
  food_alias: string | null
  quantity_text: string | null
  grams: number | null
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  estimate_level: string
  source_kind: string
  source_ref: JsonRecord
  confidence_score: number | null
  needs_review: boolean
  created_at: string
  updated_at: string
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'date must use YYYY-MM-DD format')
  }

  return date
}

function startOfWeek(date: Date) {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = normalized.getUTCDay() || 7
  normalized.setUTCDate(normalized.getUTCDate() - (day - 1))
  return normalized
}

function endOfWeek(date: Date) {
  const normalized = startOfWeek(date)
  normalized.setUTCDate(normalized.getUTCDate() + 6)
  return normalized
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toJsonRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {}
}

function mapDayLog(row: Record<string, unknown>): CalorieDayLogRecord {
  return {
    id: String(row.id),
    owner_user_id: String(row.owner_user_id),
    log_date: String(row.log_date),
    target_calories: asNumber(row.target_calories) ?? 1900,
    target_protein_g: asNumber(row.target_protein_g) ?? 130,
    target_gap_min: asNumber(row.target_gap_min) ?? 300,
    target_gap_max: asNumber(row.target_gap_max) ?? 400,
    status: String(row.status),
    notes: asString(row.notes),
    metadata: toJsonRecord(row.metadata),
    latest_summary_run_id: asString(row.latest_summary_run_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapMeal(row: Record<string, unknown>): CalorieMealRecord {
  return {
    id: String(row.id),
    day_log_id: String(row.day_log_id),
    meal_type: String(row.meal_type),
    meal_label: asString(row.meal_label),
    occurred_at: asString(row.occurred_at),
    source_thread_id: asString(row.source_thread_id),
    source_message_id: asString(row.source_message_id),
    metadata: toJsonRecord(row.metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapEntry(row: Record<string, unknown>): CalorieEntryRecord {
  return {
    id: String(row.id),
    meal_id: String(row.meal_id),
    food_name: String(row.food_name),
    food_alias: asString(row.food_alias),
    quantity_text: asString(row.quantity_text),
    grams: asNumber(row.grams),
    calories: asNumber(row.calories),
    protein_g: asNumber(row.protein_g),
    fat_g: asNumber(row.fat_g),
    carbs_g: asNumber(row.carbs_g),
    fiber_g: asNumber(row.fiber_g),
    sugar_g: asNumber(row.sugar_g),
    sodium_mg: asNumber(row.sodium_mg),
    estimate_level: String(row.estimate_level),
    source_kind: String(row.source_kind),
    source_ref: toJsonRecord(row.source_ref),
    confidence_score: asNumber(row.confidence_score),
    needs_review: Boolean(row.needs_review),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function addNutritionTotals(
  current: Record<'calories' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg', number>,
  entry: CalorieEntryRecord
) {
  current.calories += entry.calories ?? 0
  current.protein_g += entry.protein_g ?? 0
  current.fat_g += entry.fat_g ?? 0
  current.carbs_g += entry.carbs_g ?? 0
  current.fiber_g += entry.fiber_g ?? 0
  current.sugar_g += entry.sugar_g ?? 0
  current.sodium_mg += entry.sodium_mg ?? 0
  return current
}

function createEmptyTotals() {
  return {
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
  }
}

async function getDayLog(ownerUserId: string, date: string) {
  const { data, error } = await supabaseAdmin
    .from('calorie_day_logs')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('log_date', date)
    .single()

  if (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST116') {
      return null
    }

    throw new AppError(500, error instanceof Error ? error.message : 'Failed to load calorie day log')
  }

  return mapDayLog(data as Record<string, unknown>)
}

async function ensureDayLog(ownerUserId: string, date: string) {
  const existing = await getDayLog(ownerUserId, date)
  if (existing) {
    return existing
  }

  const { data, error } = await supabaseAdmin
    .from('calorie_day_logs')
    .insert({
      owner_user_id: ownerUserId,
      log_date: date,
    })
    .select('*')
    .single()

  if (error) {
    throw new AppError(500, error.message)
  }

  return mapDayLog(data as Record<string, unknown>)
}

async function listMeals(dayLogId: string) {
  const { data, error } = await supabaseAdmin
    .from('calorie_meals')
    .select('*')
    .eq('day_log_id', dayLogId)
    .order('occurred_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []).map((row) => mapMeal(row as Record<string, unknown>))
}

async function listEntries(mealIds: string[]) {
  if (mealIds.length === 0) {
    return [] as CalorieEntryRecord[]
  }

  const { data, error } = await supabaseAdmin
    .from('calorie_entries')
    .select('*')
    .in('meal_id', mealIds)
    .order('created_at', { ascending: true })

  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []).map((row) => mapEntry(row as Record<string, unknown>))
}

async function buildCalorieDayResponse(ownerUserId: string, date: string) {
  const normalizedDate = normalizeDate(date)
  const dayLog = await getDayLog(ownerUserId, normalizedDate)

  if (!dayLog) {
    return {
      date: normalizedDate,
      dayLog: null,
      totals: createEmptyTotals(),
      meals: [],
      summary: {
        mealCount: 0,
        entryCount: 0,
        reviewedEntryCount: 0,
      },
    }
  }

  const meals = await listMeals(dayLog.id)
  const entries = await listEntries(meals.map((meal) => meal.id))
  const entriesByMealId = new Map<string, CalorieEntryRecord[]>()

  for (const entry of entries) {
    const existing = entriesByMealId.get(entry.meal_id) ?? []
    existing.push(entry)
    entriesByMealId.set(entry.meal_id, existing)
  }

  const totals = createEmptyTotals()
  let entryCount = 0
  let reviewedEntryCount = 0

  const mealPayload = meals.map((meal) => {
    const mealEntries = entriesByMealId.get(meal.id) ?? []
    const mealTotals = createEmptyTotals()

    for (const entry of mealEntries) {
      addNutritionTotals(totals, entry)
      addNutritionTotals(mealTotals, entry)
      entryCount += 1
      if (!entry.needs_review) {
        reviewedEntryCount += 1
      }
    }

    return {
      ...meal,
      totals: mealTotals,
      items: mealEntries,
    }
  })

  return {
    date: normalizedDate,
    dayLog,
    totals,
    meals: mealPayload,
    summary: {
      mealCount: meals.length,
      entryCount,
      reviewedEntryCount,
    },
  }
}

function getDraftPayloadFromRun(runParsedOutput: JsonRecord) {
  const draftPayload = runParsedOutput.draftPayload
  if (!draftPayload) {
    throw new AppError(409, 'Run does not contain a draftPayload')
  }

  return validateCalorieDraftPayload(draftPayload)
}

function inferReportRange(period: CalorieReportPeriod, anchor: string) {
  const date = new Date(`${normalizeDate(anchor)}T00:00:00.000Z`)

  if (period === 'day') {
    return { start: formatDate(date), end: formatDate(date) }
  }

  if (period === 'week') {
    return {
      start: formatDate(startOfWeek(date)),
      end: formatDate(endOfWeek(date)),
    }
  }

  return {
    start: formatDate(startOfMonth(date)),
    end: formatDate(endOfMonth(date)),
  }
}

function buildReportInsights(input: {
  totals: ReturnType<typeof createEmptyTotals>
  dayCount: number
  estimatedRatio: number
}) {
  const insights: string[] = []

  if (input.dayCount > 0) {
    const averageCalories = input.totals.calories / input.dayCount
    insights.push(`平均每日摄入 ${averageCalories.toFixed(0)} kcal。`)
  }

  if (input.totals.protein_g > 0 && input.dayCount > 0) {
    const averageProtein = input.totals.protein_g / input.dayCount
    insights.push(`平均每日蛋白质 ${averageProtein.toFixed(1)} g。`)
  }

  if (input.estimatedRatio >= 0.5) {
    insights.push('当前区间里估算条目占比偏高，建议优先确认包装或称重信息。')
  }

  return insights
}

function revalidateCalorieCache(date: string, workspaceId?: string) {
  revalidateTag(CALORIE_CACHE_TAGS.workspaces, 'max')
  revalidateTag(CALORIE_CACHE_TAGS.reports, 'max')
  revalidateTag(getCalorieDayTag(date), 'max')

  if (workspaceId) {
    revalidateTag(getCalorieWorkspaceTag(workspaceId), 'max')
  }
}

export async function listCalorieWorkspaces(ownerUserId: string) {
  return listAgentThreadsForOwner({
    ownerUserId,
    appKey: 'calorie',
    taskKey: 'workspace',
    limit: 50,
  })
}

export async function createCalorieWorkspace(input: {
  ownerUserId: string
  title?: string | null
  metadata?: JsonRecord
}) {
  return createAgentThreadForOwner({
    ownerUserId: input.ownerUserId,
    appKey: 'calorie',
    taskKey: 'workspace',
    title: input.title ?? 'Calorie Workspace',
    metadata: input.metadata ?? {},
  })
}

export async function postCalorieWorkspaceMessage(input: {
  ownerUserId: string
  workspaceId: string
  textContent?: string | null
  structuredContent?: JsonRecord
  attachmentIds?: string[]
  requestPayload?: JsonRecord
}) {
  const workspace = await getAgentThreadBundleOrThrow({ threadId: input.workspaceId, ownerUserId: input.ownerUserId })
  if (workspace.thread.app_key !== 'calorie' || workspace.thread.task_key !== 'workspace') {
    throw new AppError(400, 'Workspace is not a calorie workspace')
  }

  const userMessage = await createAgentMessageForOwner({
    threadId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    role: 'user',
    textContent: input.textContent ?? null,
    structuredContent: input.structuredContent ?? {},
    sourceKind: 'manual',
  })

  const runResult = await executeAgentRunForOwner({
    ownerUserId: input.ownerUserId,
    threadId: input.workspaceId,
    messageId: userMessage.id,
    attachmentIds: input.attachmentIds,
    requestPayload: input.requestPayload,
  })

  revalidateTag(getCalorieWorkspaceTag(input.workspaceId), 'max')
  revalidateTag(CALORIE_CACHE_TAGS.workspaces, 'max')

  return {
    thread: workspace.thread,
    userMessage,
    run: runResult.run,
    assistantMessage: runResult.assistantMessage,
    draftPayload: runResult.parsed?.draftPayload ?? null,
  }
}

export async function getCalorieDay(ownerUserId: string, date: string) {
  return buildCalorieDayResponse(ownerUserId, date)
}

export async function patchCalorieDay(input: {
  ownerUserId: string
  date: string
  updates: JsonRecord
}) {
  const normalizedDate = normalizeDate(input.date)
  const dayLog = await ensureDayLog(input.ownerUserId, normalizedDate)

  const patch: JsonRecord = {}
  if (typeof input.updates.targetCalories === 'number') {
    patch.target_calories = input.updates.targetCalories
  }
  if (typeof input.updates.targetProteinG === 'number') {
    patch.target_protein_g = input.updates.targetProteinG
  }
  if (typeof input.updates.targetGapMin === 'number') {
    patch.target_gap_min = input.updates.targetGapMin
  }
  if (typeof input.updates.targetGapMax === 'number') {
    patch.target_gap_max = input.updates.targetGapMax
  }
  if (typeof input.updates.status === 'string') {
    patch.status = input.updates.status
  }
  if (typeof input.updates.notes === 'string' || input.updates.notes === null) {
    patch.notes = input.updates.notes
  }
  if (isRecord(input.updates.metadata)) {
    patch.metadata = {
      ...dayLog.metadata,
      ...input.updates.metadata,
    }
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('calorie_day_logs')
      .update(patch)
      .eq('id', dayLog.id)

    if (error) {
      throw new AppError(500, error.message)
    }
  }

  revalidateCalorieCache(normalizedDate)
  return buildCalorieDayResponse(input.ownerUserId, normalizedDate)
}

export async function commitCalorieRun(input: {
  ownerUserId: string
  runId: string
  dateOverride?: string | null
  editedPayload?: CalorieDraftPayload | null
}) {
  const { run, thread } = await getAgentRunDetailOrThrow({ runId: input.runId, ownerUserId: input.ownerUserId })
  if (thread.app_key !== 'calorie' || thread.task_key !== 'workspace') {
    throw new AppError(400, 'Run is not a calorie workspace run')
  }

  const draft = input.editedPayload ?? getDraftPayloadFromRun(run.parsed_output)
  const targetDate = normalizeDate(input.dateOverride ?? draft.date ?? new Date().toISOString().slice(0, 10))
  const dayLog = await ensureDayLog(input.ownerUserId, targetDate)

  const { data: existingMeals, error: existingMealsError } = await supabaseAdmin
    .from('calorie_meals')
    .select('id')
    .eq('day_log_id', dayLog.id)
    .contains('metadata', { source_run_id: run.id })

  if (existingMealsError) {
    throw new AppError(500, existingMealsError.message)
  }

  if ((existingMeals ?? []).length > 0) {
    return buildCalorieDayResponse(input.ownerUserId, targetDate)
  }

  const sourceMessageId = typeof run.request_payload.messageId === 'string' ? run.request_payload.messageId : null

  for (const meal of draft.meals) {
    const { data: createdMeal, error: mealError } = await supabaseAdmin
      .from('calorie_meals')
      .insert({
        day_log_id: dayLog.id,
        meal_type: meal.meal_type,
        meal_label: meal.meal_label ?? null,
        occurred_at: meal.occurred_at ?? null,
        source_thread_id: thread.id,
        source_message_id: sourceMessageId,
        metadata: {
          source_run_id: run.id,
        },
      })
      .select('id')
      .single()

    if (mealError || !createdMeal) {
      throw new AppError(500, mealError?.message ?? 'Failed to create calorie meal')
    }

    const payload = meal.items.map((item) => ({
      meal_id: String(createdMeal.id),
      food_name: item.food_name,
      food_alias: item.food_alias ?? null,
      quantity_text: item.quantity_text ?? null,
      grams: item.grams ?? null,
      calories: item.calories ?? null,
      protein_g: item.protein_g ?? null,
      fat_g: item.fat_g ?? null,
      carbs_g: item.carbs_g ?? null,
      fiber_g: item.fiber_g ?? null,
      sugar_g: item.sugar_g ?? null,
      sodium_mg: item.sodium_mg ?? null,
      estimate_level: item.estimate_level,
      source_kind: item.source_kind,
      source_ref: {
        ...(item.source_ref ?? {}),
        source_run_id: run.id,
      },
      confidence_score: item.confidence_score ?? null,
      needs_review: item.needs_review ?? true,
    }))

    const { error: entryError } = await supabaseAdmin
      .from('calorie_entries')
      .insert(payload)

    if (entryError) {
      throw new AppError(500, entryError.message)
    }
  }

  const { error: dayLogUpdateError } = await supabaseAdmin
    .from('calorie_day_logs')
    .update({
      latest_summary_run_id: run.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dayLog.id)

  if (dayLogUpdateError) {
    throw new AppError(500, dayLogUpdateError.message)
  }

  revalidateCalorieCache(targetDate, thread.id)
  return buildCalorieDayResponse(input.ownerUserId, targetDate)
}

export async function getCalorieReports(input: {
  ownerUserId: string
  period: CalorieReportPeriod
  anchor: string
}) {
  const range = inferReportRange(input.period, input.anchor)

  const { data: dayLogRows, error: dayLogError } = await supabaseAdmin
    .from('calorie_day_logs')
    .select('*')
    .eq('owner_user_id', input.ownerUserId)
    .gte('log_date', range.start)
    .lte('log_date', range.end)
    .order('log_date', { ascending: true })

  if (dayLogError) {
    throw new AppError(500, dayLogError.message)
  }

  const dayLogs = (dayLogRows ?? []).map((row) => mapDayLog(row as Record<string, unknown>))
  const dayLogIds = dayLogs.map((dayLog) => dayLog.id)
  const { data: mealRows, error: mealError } = await supabaseAdmin
    .from('calorie_meals')
    .select('*')
    .in('day_log_id', dayLogIds.length > 0 ? dayLogIds : ['00000000-0000-0000-0000-000000000000'])

  if (mealError) {
    throw new AppError(500, mealError.message)
  }

  const meals = (mealRows ?? []).map((row) => mapMeal(row as Record<string, unknown>))
  const mealIds = meals.map((meal) => meal.id)
  const entries = await listEntries(mealIds)
  const mealById = new Map(meals.map((meal) => [meal.id, meal]))
  const dayLogById = new Map(dayLogs.map((dayLog) => [dayLog.id, dayLog]))
  const totals = createEmptyTotals()
  const sourceSummary = new Map<string, { entries: number; calories: number }>()
  const dailyTotals = new Map<string, ReturnType<typeof createEmptyTotals>>()
  let estimatedEntryCount = 0

  for (const entry of entries) {
    addNutritionTotals(totals, entry)

    const meal = mealById.get(entry.meal_id)
    const dayLog = meal ? dayLogById.get(meal.day_log_id) : null
    if (dayLog) {
      const currentDayTotals = dailyTotals.get(dayLog.log_date) ?? createEmptyTotals()
      addNutritionTotals(currentDayTotals, entry)
      dailyTotals.set(dayLog.log_date, currentDayTotals)
    }

    const sourceItem = sourceSummary.get(entry.source_kind) ?? { entries: 0, calories: 0 }
    sourceItem.entries += 1
    sourceItem.calories += entry.calories ?? 0
    sourceSummary.set(entry.source_kind, sourceItem)

    if (entry.estimate_level === 'estimated') {
      estimatedEntryCount += 1
    }
  }

  const estimatedRatio = entries.length > 0 ? estimatedEntryCount / entries.length : 0
  const days = dayLogs.map((dayLog) => ({
    date: dayLog.log_date,
    totals: dailyTotals.get(dayLog.log_date) ?? createEmptyTotals(),
    targets: {
      calories: dayLog.target_calories,
      protein_g: dayLog.target_protein_g,
      gap_min: dayLog.target_gap_min,
      gap_max: dayLog.target_gap_max,
    },
  }))

  const response = {
    period: input.period,
    anchor: normalizeDate(input.anchor),
    dateRange: range,
    totals,
    estimateRatio: estimatedRatio,
    days,
    sourceSummary: Array.from(sourceSummary.entries()).map(([sourceKind, value]) => ({
      sourceKind,
      entries: value.entries,
      calories: value.calories,
    })),
    insights: buildReportInsights({
      totals,
      dayCount: Math.max(days.length, 1),
      estimatedRatio,
    }),
  }

  return response
}

export async function deleteCalorieWorkspace(input: { ownerUserId: string; workspaceId: string }) {
  await getAgentThreadBundleOrThrow({ threadId: input.workspaceId, ownerUserId: input.ownerUserId })

  const { error } = await supabaseAdmin.from('agent_threads').delete().eq('id', input.workspaceId)
  if (error) {
    throw new AppError(500, error.message)
  }

  revalidateTag(CALORIE_CACHE_TAGS.workspaces, 'max')
}

export async function discardCalorieRun(input: { ownerUserId: string; runId: string }) {
  const { run, thread } = await getAgentRunDetailOrThrow({ runId: input.runId, ownerUserId: input.ownerUserId })
  if (thread.app_key !== 'calorie' || thread.task_key !== 'workspace') {
    throw new AppError(400, 'Run is not a calorie workspace run')
  }

  if (run.status !== 'needs_confirmation') {
    throw new AppError(409, 'Only runs in needs_confirmation state can be discarded')
  }

  const { error } = await supabaseAdmin
    .from('agent_runs')
    .update({ status: 'discarded', finished_at: new Date().toISOString() })
    .eq('id', input.runId)

  if (error) {
    throw new AppError(500, error.message)
  }

  revalidateTag(getCalorieWorkspaceTag(thread.id), 'max')
}

export async function deleteCalorieMeal(input: { ownerUserId: string; mealId: string }) {
  const { data: meal, error: fetchError } = await supabaseAdmin
    .from('calorie_meals')
    .select('id, day_log_id')
    .eq('id', input.mealId)
    .single()

  if (fetchError || !meal) {
    throw new AppError(404, 'Meal not found')
  }

  const { data: dayLog, error: dayLogError } = await supabaseAdmin
    .from('calorie_day_logs')
    .select('id, log_date, owner_user_id')
    .eq('id', (meal as Record<string, unknown>).day_log_id)
    .single()

  if (dayLogError || !dayLog) {
    throw new AppError(404, 'Day log not found')
  }

  const typedLog = dayLog as Record<string, unknown>
  if (typedLog.owner_user_id !== input.ownerUserId) {
    throw new AppError(403, 'Not authorized to delete this meal')
  }

  const { error: deleteError } = await supabaseAdmin.from('calorie_meals').delete().eq('id', input.mealId)
  if (deleteError) {
    throw new AppError(500, deleteError.message)
  }

  const date = String(typedLog.log_date)
  revalidateCalorieCache(date)
  return { date }
}