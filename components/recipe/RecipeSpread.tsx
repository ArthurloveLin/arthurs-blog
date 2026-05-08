import type { RecipeListItem, RecipeRevision } from '@/lib/recipes'
import { getRecipeBySlug, getRecipeRevisions } from '@/lib/recipes'
import type { ReactNode } from 'react'
import BookSpread from './BookSpread'
import RecipeLeftPage from './RecipeLeftPage'
import RecipeRightPage from './RecipeRightPage'
import RecipeSpreadClient from './RecipeSpreadClient'

interface RecipeSpreadProps {
  recipe: RecipeListItem
}

interface AdminRecipeSpreadViewProps {
  currentVersion: string
  revisions: RecipeRevision[]
  condensedLeftPage: ReactNode
  rightPage: ReactNode
  slug: string
  published: boolean
}

function AdminRecipeSpreadView({
  currentVersion,
  revisions,
  condensedLeftPage,
  rightPage,
  slug,
  published,
}: AdminRecipeSpreadViewProps) {
  return (
    <RecipeSpreadClient
      slug={slug}
      initialPublished={published}
      currentVersion={currentVersion}
      revisions={revisions}
      condensedLeftPage={condensedLeftPage}
      rightPage={rightPage}
    />
  )
}

export async function AdminRecipeSpread({ recipe }: RecipeSpreadProps) {
  const [fullRecipe, revisions] = await Promise.all([
    getRecipeBySlug(recipe.slug),
    getRecipeRevisions(recipe.id),
  ])

  if (!fullRecipe) {
    return null
  }

  return (
    <AdminRecipeSpreadView
      slug={fullRecipe.slug}
      published={fullRecipe.published}
      currentVersion={fullRecipe.version}
      revisions={revisions}
      condensedLeftPage={<RecipeLeftPage recipe={fullRecipe} revisions={[]} />}
      rightPage={<RecipeRightPage recipe={fullRecipe} />}
    />
  )
}

export async function PublicRecipeSpread({ recipe }: RecipeSpreadProps) {
  const [fullRecipe, revisions] = await Promise.all([
    getRecipeBySlug(recipe.slug),
    getRecipeRevisions(recipe.id),
  ])

  if (!fullRecipe) {
    return null
  }

  return (
    <BookSpread
      left={<RecipeLeftPage recipe={fullRecipe} revisions={revisions} />}
      right={<RecipeRightPage recipe={fullRecipe} />}
    />
  )
}
