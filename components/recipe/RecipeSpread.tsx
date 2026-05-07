import type { Recipe } from '@/lib/recipes'
import { getRecipeRevisions, getRecipeSkillGraph } from '@/lib/recipes'
import BookSpread from './BookSpread'
import RecipeLeftPage from './RecipeLeftPage'
import RecipeRightPage from './RecipeRightPage'
import RecipeSpreadClient from './RecipeSpreadClient'

interface Props {
  recipe: Recipe
  isAdmin: boolean
}

export default async function RecipeSpread({ recipe, isAdmin }: Props) {
  const [revisions, skillGraph] = await Promise.all([
    getRecipeRevisions(recipe.id),
    getRecipeSkillGraph(),
  ])

  // Admin gets interactive client component (supports inline editing)
  if (isAdmin) {
    return (
      <RecipeSpreadClient
        recipe={recipe}
        revisions={revisions}
        skillGraph={skillGraph}
      />
    )
  }

  // Public: fully static server render
  return (
    <BookSpread
      left={<RecipeLeftPage recipe={recipe} revisions={revisions} />}
      right={<RecipeRightPage recipe={recipe} skillGraph={skillGraph} />}
    />
  )
}
