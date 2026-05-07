import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '@/components/PageHero'
import BookShell from '@/components/recipe/BookShell'
import BookSpread from '@/components/recipe/BookSpread'
import TableOfContentsPage from '@/components/recipe/TableOfContentsPage'
import RecipeSpread from '@/components/recipe/RecipeSpread'
import { getAllRecipesList } from '@/lib/recipes'
import { isAdminRequest } from '@/lib/auth'

export const metadata: Metadata = {
  title: '菜谱档案',
  description: '私人菜谱书：食材步骤、风味雷达、技能图谱，长期维护的烹饪档案。',
}

export default async function RecipePage() {
  const [recipes, isAdmin] = await Promise.all([
    getAllRecipesList(),
    isAdminRequest(),
  ])

  const visibleRecipes = isAdmin ? recipes : recipes.filter((r) => r.published)

  return (
    <main className="min-h-screen bg-background">
      <PageHero
        subtitle="私人档案"
        title="菜谱档案"
        description="长期维护的烹饪记录：食材、步骤、风味、技能树，像翻一本书一样回看每道菜的演进。"
        blobColors={['bg-orange-400/10', 'bg-amber-400/10']}
      />

      <div className="site-shell py-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase mb-8"
        >
          ← Home
        </Link>

        {visibleRecipes.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-4xl mb-4">📖</p>
            <p className="text-sm">菜谱档案正在整理中，敬请期待…</p>
          </div>
        ) : (
          <BookShell>
            {/* Spread 0: Table of Contents */}
            <BookSpread
              left={<TableOfContentsPage recipes={visibleRecipes} side="left" />}
              right={<TableOfContentsPage recipes={visibleRecipes} side="right" />}
            />

            {/* One spread per recipe */}
            {visibleRecipes.map((recipe) => (
              <RecipeSpread key={recipe.id} recipe={recipe} isAdmin={isAdmin} />
            ))}
          </BookShell>
        )}
      </div>
    </main>
  )
}
