import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '@/components/PageHero'
import BookShell, { type BookmarkItem } from '@/components/recipe/BookShell'
import BookSpread from '@/components/recipe/BookSpread'
import TableOfContentsPage from '@/components/recipe/TableOfContentsPage'
import RecipeSpread from '@/components/recipe/RecipeSpread'
import { getRecipesList, getAllRecipesListFresh } from '@/lib/recipes'
import { isAdminRequest } from '@/lib/auth'

export const metadata: Metadata = {
  title: '菜谱档案',
  description: '私人菜谱书：食材步骤、风味雷达、技能图谱，长期维护的烹饪档案。',
}

function buildBookmarks(recipes: Awaited<ReturnType<typeof getRecipesList>>): BookmarkItem[] {
  return [
    { label: '目录' },
    ...recipes.map((r) => ({ label: r.title })),
  ]
}

export default async function RecipePage() {
  const isAdmin = await isAdminRequest()

  // Admin always gets fresh data directly from DB (no cache layer).
  // Public gets the ISR-cached published-only list.
  const recipes = isAdmin ? await getAllRecipesListFresh() : await getRecipesList()

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

        <BookShell bookmarks={buildBookmarks(recipes)}>
          <BookSpread
            left={<TableOfContentsPage recipes={recipes} side="left" />}
            right={<TableOfContentsPage recipes={recipes} side="right" />}
          />
          {recipes.map((recipe) => (
            <RecipeSpread key={recipe.id} recipe={recipe} isAdmin={isAdmin} />
          ))}
        </BookShell>
      </div>
    </main>
  )
}
