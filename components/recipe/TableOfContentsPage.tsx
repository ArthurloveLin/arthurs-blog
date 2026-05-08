import type { RecipeListItem } from '@/lib/recipes'

interface TableOfContentsProps {
  recipes: RecipeListItem[]
}

const ink = 'oklch(0.22 0.03 50)'
const muted = 'oklch(0.52 0.03 50)'
const accent = 'oklch(0.55 0.18 35)'
const accentFaded = 'oklch(0.65 0.18 35 / 0.5)'
const rule = '1px solid oklch(0.65 0.18 35 / 0.18)'

function CategoryRecipeList({ recipes }: TableOfContentsProps) {
  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))] as string[]

  if (categories.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {categories.map((cat) => {
          const items = recipes.filter((recipe) => recipe.category === cat)
          return (
            <div key={cat}>
              <p style={{
                fontSize: 10,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: accentFaded,
                fontWeight: 600,
                marginBottom: 8,
              }}>
                {cat}
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {items.map((recipe, index) => (
                  <li key={recipe.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                    <span style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: accentFaded,
                      flexShrink: 0,
                      width: 18,
                      textAlign: 'right',
                    }}>
                      {index + 1}
                    </span>
                    <span style={{
                      flex: 1,
                      borderBottom: `1px dotted oklch(0.65 0.18 35 / 0.22)`,
                      paddingBottom: 1,
                      color: ink,
                    }}>
                      {recipe.title}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: accentFaded, flexShrink: 0 }}>
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
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {recipes.map((recipe, index) => (
        <li key={recipe.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: accentFaded, flexShrink: 0, width: 18, textAlign: 'right' }}>
            {index + 1}
          </span>
          <span style={{ flex: 1, borderBottom: `1px dotted oklch(0.65 0.18 35 / 0.22)`, paddingBottom: 1, color: ink }}>
            {recipe.title}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: accentFaded, flexShrink: 0 }}>
            v{recipe.version}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function TableOfContentsLeftPage({ recipes }: TableOfContentsProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, color: ink }}>
      {/* Header */}
      <div style={{ paddingBottom: 14, borderBottom: rule }}>
        <p style={{
          fontSize: 10,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          color: accent,
          fontWeight: 600,
          marginBottom: 8,
        }}>
          目录
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, color: ink, letterSpacing: '-0.01em' }}>
          菜谱档案
        </h2>
        <p style={{ fontSize: 12, color: muted, marginTop: 6 }}>
          共 {recipes.length} 道菜
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CategoryRecipeList recipes={recipes} />
      </div>
    </div>
  )
}

export function TableOfContentsRightPage({ recipes }: TableOfContentsProps) {
  const recent = [...recipes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, color: ink }}>
      {/* Header */}
      <div style={{ paddingBottom: 14, borderBottom: rule }}>
        <p style={{
          fontSize: 10,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          color: accent,
          fontWeight: 600,
        }}>
          最近更新
        </p>
      </div>

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {recent.map((r) => (
          <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: ink, lineHeight: 1.25 }}>
              {r.title}
            </p>
            <p style={{ fontSize: 11, color: muted, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
              v{r.version}
              {' · '}
              {new Date(r.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              {r.category && ` · ${r.category}`}
            </p>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: rule }}>
        <p style={{ fontSize: 12, lineHeight: 1.75, color: muted, fontStyle: 'italic' }}>
          每一道菜都是一次实验，每一次修改都是一段成长。
          翻阅这些记录，不只是找食谱，更是回看学习的轨迹。
        </p>
      </div>
    </div>
  )
}
