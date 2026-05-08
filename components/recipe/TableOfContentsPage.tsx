import type { Recipe } from '@/lib/recipes'

interface TableOfContentsProps {
  recipes: Recipe[]
}

function TableOfContentsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col gap-3 text-sm" style={{ color: 'oklch(0.3 0.02 50)' }}>
      {children}
    </div>
  )
}

function CategoryRecipeList({ recipes }: TableOfContentsProps) {
  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))] as string[]

  if (categories.length > 0) {
    return (
      <div className="space-y-3">
        {categories.map((cat) => {
          const items = recipes.filter((recipe) => recipe.category === cat)
          return (
            <div key={cat}>
              <p className="text-[10px] font-mono tracking-widest uppercase text-amber-800/50 mb-1">
                {cat}
              </p>
              <ul className="space-y-0.5">
                {items.map((recipe, index) => (
                  <li key={recipe.id} className="flex items-baseline gap-1.5 text-xs">
                    <span className="text-amber-800/40 shrink-0 w-4 text-right tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex-1 border-b border-dotted border-amber-800/20 pb-px">
                      {recipe.title}
                    </span>
                    <span className="text-amber-800/40 shrink-0 text-[10px]">
                      v{recipe.version}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <ul className="space-y-0.5">
      {recipes.map((recipe, index) => (
        <li key={recipe.id} className="flex items-baseline gap-1.5 text-xs">
          <span className="text-amber-800/40 shrink-0 w-4 text-right tabular-nums">{index + 1}</span>
          <span className="flex-1 border-b border-dotted border-amber-800/20 pb-px">
            {recipe.title}
          </span>
          <span className="text-amber-800/40 shrink-0 text-[10px]">v{recipe.version}</span>
        </li>
      ))}
    </ul>
  )
}

export function TableOfContentsLeftPage({ recipes }: TableOfContentsProps) {
  return (
    <TableOfContentsFrame>
      <div className="border-b border-amber-800/20 pb-2 mb-1">
        <p className="text-[10px] font-mono tracking-widest uppercase text-amber-800/60">目录</p>
        <h2 className="text-lg font-bold leading-tight mt-0.5">菜谱档案</h2>
        <p className="text-[11px] text-amber-800/60 mt-0.5">共 {recipes.length} 道菜</p>
      </div>
      <CategoryRecipeList recipes={recipes} />
    </TableOfContentsFrame>
  )
}

export function TableOfContentsRightPage({ recipes }: TableOfContentsProps) {
  const recent = [...recipes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  return (
    <TableOfContentsFrame>
      <div className="border-b border-amber-800/20 pb-2 mb-1">
        <p className="text-[10px] font-mono tracking-widest uppercase text-amber-800/60">最近更新</p>
      </div>
      <ul className="space-y-2">
        {recent.map((r) => (
          <li key={r.id} className="text-xs">
            <p className="font-medium">{r.title}</p>
            <p className="text-[10px] text-amber-800/50">
              v{r.version} ·{' '}
              {new Date(r.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              {r.category && ` · ${r.category}`}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-3 border-t border-amber-800/20">
        <p className="text-[10px] leading-relaxed text-amber-800/50">
          每一道菜都是一次实验，每一次修改都是一段成长。
          翻阅这些记录，不只是找食谱，更是回看学习的轨迹。
        </p>
      </div>
    </TableOfContentsFrame>
  )
}
