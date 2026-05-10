import type { Recipe, RecipeListItem, RecipeRevision } from '@/lib/recipes'
import { getRecipeBySlug, getRecipeRevisions } from '@/lib/recipes'
import type { ReactNode } from 'react'
import BookSpread from './BookSpread'
import RecipeLeftPage from './RecipeLeftPage'
import RecipeRightPage from './RecipeRightPage'
import RecipeSpreadClient from './RecipeSpreadClient'
import { RecipeDesktopThemeBookmarkGroup } from './RecipeDesktopThemeBookmark'
import type { RecipeRevisionPreview } from './revision-preview'

interface RecipeSpreadProps {
  recipe: RecipeListItem
}

interface AdminRecipeSpreadViewProps {
  currentVersion: string
  revisionPreviews: RecipeRevisionPreview[]
  condensedLeftPage: ReactNode
  rightPage: ReactNode
  slug: string
  published: boolean
}

function buildRevisionPreviews(recipeId: string, revisions: RecipeRevision[]): RecipeRevisionPreview[] {
  return revisions.map((revision) => {
    const snapshot = revision.snapshot

    if (!snapshot) {
      return {
        id: revision.id,
        version: revision.version,
        createdAt: revision.created_at,
        changeSummary: revision.change_summary,
        hasSnapshot: false,
        snapshotTitle: null,
        snapshotCategory: null,
        leftPage: null,
        rightPage: null,
      }
    }

    const previewRecipe: Recipe = {
      ...snapshot,
      id: recipeId,
      created_at: revision.created_at,
      updated_at: revision.created_at,
    }

    return {
      id: revision.id,
      version: revision.version,
      createdAt: revision.created_at,
      changeSummary: revision.change_summary,
      hasSnapshot: true,
      snapshotTitle: snapshot.title ?? null,
      snapshotCategory: snapshot.category,
      leftPage: <RecipeLeftPage recipe={previewRecipe} revisions={[]} />,
      rightPage: <RecipeRightPage recipe={previewRecipe} />,
    }
  })
}

function AdminRecipeSpreadView({
  currentVersion,
  revisionPreviews,
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
      revisionPreviews={revisionPreviews}
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

  const revisionPreviews = buildRevisionPreviews(fullRecipe.id, revisions)

  return (
    <AdminRecipeSpreadView
      slug={fullRecipe.slug}
      published={fullRecipe.published}
      currentVersion={fullRecipe.version}
      revisionPreviews={revisionPreviews}
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
      rightOverlay={<RecipeDesktopThemeBookmarkGroup />}
    />
  )
}
