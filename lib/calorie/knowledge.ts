import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { cache } from 'react'

import { getAgentRuntimeConfig } from '@/lib/agent-runtime/config'

export type CalorieKnowledgeItemKind = 'food' | 'reference'

export interface CalorieKnowledgeNutrition {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  weight_g: number | null
}

export interface CalorieKnowledgeItem {
  id: string
  kind: CalorieKnowledgeItemKind
  canonicalName: string
  aliases: string[]
  unit: string | null
  source: string | null
  notes: string | null
  section: string | null
  subsection: string | null
  headingPath: string[]
  nutrition: CalorieKnowledgeNutrition
  approximateFields: string[]
  raw: Record<string, string>
}

export interface CalorieKnowledgeTable {
  headingPath: string[]
  columns: string[]
  rowCount: number
}

export interface CalorieKnowledgeBase {
  version: string | null
  lastUpdated: string | null
  updateNote: string | null
  sourceMarkdownPath: string
  sourceMarkdownSha256: string
  exportedAt: string
  itemCount: number
  foodItemCount: number
  referenceItemCount: number
  tables: CalorieKnowledgeTable[]
  items: CalorieKnowledgeItem[]
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[（）()]/g, '')
    .replace(/[·•]/g, '')
    .replace(/\s+/g, '')
}

function scoreKnowledgeItem(item: CalorieKnowledgeItem, query: string) {
  const normalizedCanonical = normalizeSearchText(item.canonicalName)
  const normalizedAliases = item.aliases.map((alias) => normalizeSearchText(alias))

  if (normalizedCanonical === query) return 100
  if (normalizedAliases.includes(query)) return 95
  if (normalizedCanonical.includes(query)) return 80
  if (normalizedAliases.some((alias) => alias.includes(query))) return 70

  const normalizedHeadings = item.headingPath.map((segment) => normalizeSearchText(segment))
  if (normalizedHeadings.some((segment) => segment.includes(query))) return 40

  return 0
}

function getCalorieKnowledgeJsonPath() {
  return getAgentRuntimeConfig().config.calorieDbJsonPath.value
}

export const getCalorieKnowledgeBase = cache(async (): Promise<CalorieKnowledgeBase> => {
  const filePath = getCalorieKnowledgeJsonPath()
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as CalorieKnowledgeBase

  if (!Array.isArray(parsed.items) || !Array.isArray(parsed.tables)) {
    throw new Error(`Invalid calorie knowledge JSON: ${filePath}`)
  }

  return parsed
})

export async function getCalorieKnowledgeMetadata() {
  const knowledge = await getCalorieKnowledgeBase()

  return {
    version: knowledge.version,
    lastUpdated: knowledge.lastUpdated,
    itemCount: knowledge.itemCount,
    sourceMarkdownSha256: knowledge.sourceMarkdownSha256,
  }
}

export async function findCalorieKnowledgeMatches(query: string, limit = 10) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return [] as CalorieKnowledgeItem[]
  }

  const knowledge = await getCalorieKnowledgeBase()

  return knowledge.items
    .map((item) => ({ item, score: scoreKnowledgeItem(item, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.canonicalName.localeCompare(right.item.canonicalName, 'zh-CN'))
    .slice(0, limit)
    .map((entry) => entry.item)
}

export async function getCalorieKnowledgeFingerprint() {
  const knowledge = await getCalorieKnowledgeBase()
  return createHash('sha256').update(JSON.stringify(knowledge)).digest('hex')
}