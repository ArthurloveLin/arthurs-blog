import type { Recipe } from '@/lib/recipes'

interface Props {
  recipes: Recipe[]
  side: 'left' | 'right'
}

export default function TableOfContentsPage({ recipes, side }: Props) {
  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))] as string[]

  if (side === 'left') {
    return (
      <div className="h-full flex flex-col gap-3 text-sm" style={{ color: 'oklch(0.3 0.02 50)' }}>
        <div className="border-b border-amber-800/20 pb-2 mb-1">
          <p className="text-[10px] font-mono tracking-widest uppercase text-amber-800/60">目录</p>
          <h2 className="text-lg font-bold leading-tight mt-0.5">菜谱档案</h2>
          <p className="text-[11px] text-amber-800/60 mt-0.5">共 {recipes.length} 道菜</p>
        </div>

        {categories.length > 0 ? (
          <div className="space-y-3">
            {categories.map((cat) => {
              const items = recipes.filter((r) => r.category === cat)
              return (
                <div key={cat}>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-amber-800/50 mb-1">
                    {cat}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((r, i) => (
                      <li key={r.id} className="flex items-baseline gap-1.5 text-xs">
                        <span className="text-amber-800/40 shrink-0 w-4 text-right tabular-nums">
                          {i + 1}
                        </span>
                        <span className="flex-1 border-b border-dotted border-amber-800/20 pb-px">
                          {r.title}
                        </span>
                        <span className="text-amber-800/40 shrink-0 text-[10px]">
                          v{r.version}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {recipes.map((r, i) => (
              <li key={r.id} className="flex items-baseline gap-1.5 text-xs">
                <span className="text-amber-800/40 shrink-0 w-4 text-right tabular-nums">{i + 1}</span>
                <span className="flex-1 border-b border-dotted border-amber-800/20 pb-px">
                  {r.title}
                </span>
                <span className="text-amber-800/40 shrink-0 text-[10px]">v{r.version}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // Right side: recent updates + intro
  const recent = [...recipes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  return (
    <div className="h-full flex flex-col gap-3 text-sm" style={{ color: 'oklch(0.3 0.02 50)' }}>
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
    </div>
  )
}
