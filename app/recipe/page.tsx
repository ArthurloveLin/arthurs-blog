import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import PageHero from '@/components/PageHero'
import BookShell from '@/components/recipe/BookShell'
import BookSpread from '@/components/recipe/BookSpread'
import { RecipeSkillGraphProvider } from '@/components/recipe/RecipeSkillGraphProvider'
import RecipeSpreadSkeleton from '@/components/recipe/RecipeSpreadSkeleton'
import { TableOfContentsLeftPage, TableOfContentsRightPage } from '@/components/recipe/TableOfContentsPage'
import { AdminRecipeSpread, PublicRecipeSpread } from '@/components/recipe/RecipeSpread'
import RecipeAddButton from '@/components/recipe/RecipeAddButton'
import { getAllRecipesList, getRecipeSkillGraph, getRecipesList } from '@/lib/recipes'
import { isAdminRequest } from '@/lib/auth'

export const metadata: Metadata = {
  title: '菜谱档案',
  description: '私人菜谱书：食材步骤、风味雷达、技能图谱，长期维护的烹饪档案。',
}

export default async function RecipePage() {
  const isAdmin = await isAdminRequest()

  const recipesPromise = isAdmin ? getAllRecipesList() : getRecipesList()
  const [recipes, skillGraph] = await Promise.all([recipesPromise, getRecipeSkillGraph()])

  return (
    <main className="min-h-screen bg-background">
      <PageHero
        subtitle="私人档案"
        title="菜谱档案"
        description="长期维护的烹饪记录：食材、步骤、风味、技能树，像翻一本书一样回看每道菜的演进。"
        blobColors={['bg-orange-400/10', 'bg-amber-400/10']}
      />

      <div className="site-shell py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase mb-8"
        >
          ← Home
        </Link>

        <RecipeSkillGraphProvider graph={skillGraph}>
          <BookShell>
            <BookSpread
              left={<TableOfContentsLeftPage recipes={recipes} />}
              right={<TableOfContentsRightPage recipes={recipes} />}
              rightOverlay={isAdmin && <RecipeAddButton />}
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
          </BookShell>
        </RecipeSkillGraphProvider>
      </div>
    </main>
  )
}
