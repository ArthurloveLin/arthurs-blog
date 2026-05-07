import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from './supabase-admin'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  amount: string
  unit: string
  name: string
  note?: string
}

export interface RecipeStep {
  id: string
  order: number
  title: string
  description: string
  tip?: string
}

export interface Recipe {
  id: string
  slug: string
  title: string
  description: string | null
  cover_image: string | null
  cover_image_key: string | null
  category: string | null
  version: string
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number | null
  flavor_sour: number | null
  flavor_sweet: number | null
  flavor_bitter: number | null
  flavor_spicy: number | null
  flavor_umami: number | null
  flavor_aromatic: number | null
  proficiency: number | null
  tags: string[]
  suitable_occasions: string[]
  failure_notes: string | null
  life_notes: string | null
  pairing_suggestions: string | null
  ingredients: Ingredient[]
  steps: RecipeStep[]
  published: boolean
  published_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface RecipeRevision {
  id: string
  recipe_id: string
  version: string
  change_summary: string
  created_at: string
}

export interface RecipePrerequisite {
  id: string
  from_recipe_id: string
  to_recipe_id: string
  skill_label: string
}

export interface RecipeWithPrerequisites extends Recipe {
  prerequisites_from: RecipePrerequisite[]
  prerequisites_to: RecipePrerequisite[]
}

export interface SkillGraphData {
  nodes: { id: string; slug: string; title: string; published: boolean }[]
  links: { source: string; target: string; skill_label: string }[]
}

// ── Cache tags ───────────────────────────────────────────────────────────────

export const RECIPE_CACHE_TAGS = {
  list: 'recipes',
  skillGraph: 'recipes-skill-graph',
} as const

export function getRecipeTag(slug: string) {
  return `recipe-${slug}`
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const getRecipesList = unstable_cache(
  async (): Promise<Recipe[]> => {
    const { data, error } = await supabaseAdmin
      .from('recipes')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw new Error(`getRecipesList: ${error.message}`)
    return (data ?? []) as Recipe[]
  },
  ['recipes-list'],
  { revalidate: false, tags: [RECIPE_CACHE_TAGS.list] }
)

export const getAllRecipesList = unstable_cache(
  async (): Promise<Recipe[]> => {
    const { data, error } = await supabaseAdmin
      .from('recipes')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw new Error(`getAllRecipesList: ${error.message}`)
    return (data ?? []) as Recipe[]
  },
  ['recipes-list-all'],
  { revalidate: false, tags: [RECIPE_CACHE_TAGS.list] }
)

// Uncached — always hits DB. Use for admin views where stale data is unacceptable.
export async function getAllRecipesListFresh(): Promise<Recipe[]> {
  const { data, error } = await supabaseAdmin
    .from('recipes')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getAllRecipesListFresh: ${error.message}`)
  return (data ?? []) as Recipe[]
}

export function getRecipeBySlug(slug: string) {
  return unstable_cache(
    async (): Promise<Recipe | null> => {
      const { data, error } = await supabaseAdmin
        .from('recipes')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw new Error(`getRecipeBySlug(${slug}): ${error.message}`)
      }
      return data as Recipe
    },
    [`recipe-${slug}`],
    { revalidate: false, tags: [getRecipeTag(slug)] }
  )()
}

export const getRecipeSkillGraph = unstable_cache(
  async (): Promise<SkillGraphData> => {
    const [recipesResult, prereqsResult] = await Promise.all([
      supabaseAdmin.from('recipes').select('id, slug, title, published'),
      supabaseAdmin.from('recipe_prerequisites').select('from_recipe_id, to_recipe_id, skill_label'),
    ])

    if (recipesResult.error) throw new Error(`getRecipeSkillGraph recipes: ${recipesResult.error.message}`)
    if (prereqsResult.error) throw new Error(`getRecipeSkillGraph prereqs: ${prereqsResult.error.message}`)

    return {
      nodes: (recipesResult.data ?? []) as SkillGraphData['nodes'],
      links: (prereqsResult.data ?? []).map((p) => ({
        source: p.from_recipe_id,
        target: p.to_recipe_id,
        skill_label: p.skill_label,
      })),
    }
  },
  ['recipes-skill-graph'],
  { revalidate: false, tags: [RECIPE_CACHE_TAGS.list, RECIPE_CACHE_TAGS.skillGraph] }
)

export async function getRecipeRevisions(recipeId: string): Promise<RecipeRevision[]> {
  const { data, error } = await supabaseAdmin
    .from('recipe_revisions')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getRecipeRevisions: ${error.message}`)
  return (data ?? []) as RecipeRevision[]
}

export async function getRecipeCategories(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('recipes')
    .select('category')
    .eq('published', true)
    .not('category', 'is', null)

  if (error) throw new Error(`getRecipeCategories: ${error.message}`)
  return [...new Set((data ?? []).map((r) => r.category as string))]
}
