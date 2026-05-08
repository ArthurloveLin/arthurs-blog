import type { Recipe } from '@/lib/recipes'
import { getRecipeRevisions, getRecipeSkillGraph } from '@/lib/recipes'
import BookSpread from './BookSpread'
import RecipeLeftPage from './RecipeLeftPage'
import RecipeRightPage from './RecipeRightPage'
import RecipeSpreadClient from './RecipeSpreadClient'

interface RecipeSpreadProps {
  recipe: Recipe
}

async function getRecipeSpreadData(recipeId: string) {
  return Promise.all([
    getRecipeRevisions(recipeId),
    getRecipeSkillGraph(),
  ])
}

export async function AdminRecipeSpread({ recipe }: RecipeSpreadProps) {
  const [revisions, skillGraph] = await getRecipeSpreadData(recipe.id)

  return (
    <RecipeSpreadClient
      recipe={recipe}
      revisions={revisions}
      skillGraph={skillGraph}
    />
  )
}

export async function PublicRecipeSpread({ recipe }: RecipeSpreadProps) {
  const [revisions, skillGraph] = await getRecipeSpreadData(recipe.id)

  return (
    <BookSpread
      left={<RecipeLeftPage recipe={recipe} revisions={revisions} />}
      right={<RecipeRightPage recipe={recipe} skillGraph={skillGraph} />}
    />
  )
}
