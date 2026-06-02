import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import PageHero from '@/components/PageHero'
import RecipeBookShell from '@/components/recipe/RecipeBookShell'
import BookSpread from '@/components/recipe/BookSpread'
import { RecipeDesktopThemeBookmarkGroup } from '@/components/recipe/RecipeDesktopThemeBookmark'
import { RecipeSkillGraphProvider } from '@/components/recipe/RecipeSkillGraphProvider'
import RecipeSpreadSkeleton from '@/components/recipe/RecipeSpreadSkeleton'
import { TableOfContentsLeftPage, TableOfContentsRightPage } from '@/components/recipe/TableOfContentsPage'
import { AdminRecipeSpread, PublicRecipeSpread } from '@/components/recipe/RecipeSpread'
import RecipeAddButton from '@/components/recipe/RecipeAddButton'
import { getAllRecipesList, getRecipeSkillGraph, getRecipesList } from '@/lib/recipes'
import { isAdminRequest } from '@/lib/auth'
import { getSiteConfig } from '@/lib/blog'
import { getRecipePageCopy } from '@/lib/recipe-page-copy'
import type { RecipeBookTheme } from '@/components/recipe/recipe-book-theme-context'

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig()
  const { hero } = getRecipePageCopy(config)
  
  return {
    title: `${hero.titleHighlight}${hero.titleHighlight2}${hero.titleRest}`,
    description: hero.description,
  }
}

export default async function RecipePage() {
  const isAdmin = await isAdminRequest()
  const config = await getSiteConfig()
  const { hero } = getRecipePageCopy(config)
  
  const [cookieStore, headersList] = await Promise.all([cookies(), headers()])
  const themeCookie = cookieStore.get('recipe-book-shell-theme')?.value
  const initialTheme = (themeCookie === 'page-turn' || themeCookie === 'pixel' ? themeCookie : 'pixel') as RecipeBookTheme
  
  const userAgent = headersList.get('user-agent') || ''
  const isMobile = /mobile/i.test(userAgent)

  const recipesPromise = isAdmin ? getAllRecipesList() : getRecipesList()
  const [recipes, skillGraph] = await Promise.all([recipesPromise, getRecipeSkillGraph()])

  return (
    <main className="min-h-screen bg-background">
      <PageHero
        subtitle={hero.subtitle}
        title={
          <>
            {hero.titleHighlight && <span className="block text-gradient-primary">{hero.titleHighlight}</span>}
            {hero.titleHighlight2 && <span className="block text-gradient-primary">{hero.titleHighlight2}</span>}
            {hero.titleRest}
          </>
        }
        description={hero.description}
        filename="RECIPE.md"
        slogan={hero.slogan1 ? { text1: hero.slogan1, text2: hero.slogan2 } : undefined}
        blobColors={['bg-orange-400/10', 'bg-amber-400/10']}
      />


      <div className="w-full px-4 pt-10 pb-12 md:px-6 md:pt-16">
        <RecipeSkillGraphProvider graph={skillGraph}>
          <RecipeBookShell initialTheme={initialTheme} initialIsMobile={isMobile}>
            <BookSpread
              left={<TableOfContentsLeftPage recipes={recipes} />}
              right={<TableOfContentsRightPage recipes={recipes} />}
              rightOverlay={isAdmin ? <RecipeAddButton /> : <RecipeDesktopThemeBookmarkGroup />}
            />
            {recipes.map((recipe) =>
              <Suspense key={recipe.id} fallback={<RecipeSpreadSkeleton />}>
                {isAdmin ? (
                  <AdminRecipeSpread recipe={recipe} />
                ) : (
                  <PublicRecipeSpread recipe={recipe} />
                )}
              </Suspense>
            )}
          </RecipeBookShell>
        </RecipeSkillGraphProvider>
      </div>
    </main>
  )
}
