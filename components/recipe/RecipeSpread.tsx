import type { RecipeListItem } from '@/lib/recipes'
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
  condensedLeftPage: ReactNode
  fullLeftPage: ReactNode
  rightPage: ReactNode
  slug: string
  published: boolean
}

function AdminRecipeSpreadView({
  condensedLeftPage,
  fullLeftPage,
  rightPage,
  slug,
  published,
}: AdminRecipeSpreadViewProps) {
  return (
    <RecipeSpreadClient
      slug={slug}
      initialPublished={published}
      condensedLeftPage={condensedLeftPage}
      fullLeftPage={fullLeftPage}
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
      condensedLeftPage={<RecipeLeftPage recipe={fullRecipe} revisions={revisions.slice(0, 3)} />}
      fullLeftPage={<RecipeLeftPage recipe={fullRecipe} revisions={revisions} />}
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
