import type { RecipeListItem } from '@/lib/recipes'

interface TableOfContentsProps {
  recipes: RecipeListItem[]
}

const KAMI = {
  parchment: '#f5f4ed',
  ivory: '#faf9f5',
  ink: 'oklch(0.25 0.02 50)',
  nearBlack: '#141413',
  olive: '#504e49',
  stone: '#6b6a64',
  border: 'oklch(0.45 0.02 50 / 0.3)',
  borderSoft: 'oklch(0.45 0.02 50 / 0.15)',
  tagBg: 'oklch(0.25 0.02 50 / 0.08)',
  serif: "'LXGW WenKai Screen', serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
}


function CategoryRecipeList({ recipes }: TableOfContentsProps) {
  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))] as string[]

  if (categories.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {categories.map((cat) => {
          const items = recipes.filter((recipe) => recipe.category === cat)
          return (
            <div key={cat}>
              <p style={{
                fontSize: 11,
                fontFamily: KAMI.mono,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: KAMI.stone,
                fontWeight: 600,
                marginBottom: 6,
                paddingLeft: 2,
              }}>
                {cat}
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((recipe, index) => (
                  <li key={recipe.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
                    <span style={{
                      fontSize: 11,
                      fontFamily: KAMI.mono,
                      color: KAMI.stone,
                      flexShrink: 0,
                      width: 16,
                      textAlign: 'right',
                    }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span style={{
                      flex: 1,
                      borderBottom: `0.5px dotted ${KAMI.borderSoft}`,
                      paddingBottom: 2,
                      color: KAMI.nearBlack,
                      fontWeight: 500,
                    }}>
                      {recipe.title}
                    </span>
                    <span style={{ fontSize: 10.5, fontFamily: KAMI.mono, color: KAMI.stone, flexShrink: 0 }}>
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
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {recipes.map((recipe, index) => (
        <li key={recipe.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
          <span style={{ fontSize: 11, fontFamily: KAMI.mono, color: KAMI.stone, flexShrink: 0, width: 16, textAlign: 'right' }}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span style={{ flex: 1, borderBottom: `0.5px dotted ${KAMI.borderSoft}`, paddingBottom: 2, color: KAMI.nearBlack, fontWeight: 500 }}>
            {recipe.title}
          </span>
          <span style={{ fontSize: 10.5, fontFamily: KAMI.mono, color: KAMI.stone, flexShrink: 0 }}>
            v{recipe.version}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function TableOfContentsLeftPage({ recipes }: TableOfContentsProps) {
  return (
    <div className="toc-page" style={{ 
      padding: '24px 28px',
      color: KAMI.nearBlack,
      fontFamily: KAMI.serif,
      display: 'flex', 
      flexDirection: 'column', 
      gap: 16,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ paddingBottom: 16, borderBottom: `1px solid ${KAMI.border}` }}>
        <p style={{
          fontSize: 11,
          fontFamily: KAMI.mono,
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          color: KAMI.ink,
          fontWeight: 700,
          marginBottom: 8,
        }}>
          INDEX / 目录
        </p>
        <h2 style={{ 
          fontSize: 24, 
          fontWeight: 500, 
          lineHeight: 1.2, 
          color: KAMI.nearBlack, 
          letterSpacing: '0.02em',
          fontFamily: KAMI.serif,
        }}>
          菜谱档案
        </h2>
        <p style={{ fontSize: 11.5, color: KAMI.stone, marginTop: 4, fontFamily: KAMI.mono }}>
          TOTAL {recipes.length} COLLECTIONS
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }} className="bs-page-scroll-content toc-list-scroll">
        <CategoryRecipeList recipes={recipes} />
      </div>
    </div>
  )
}

export function TableOfContentsRightPage({ recipes }: TableOfContentsProps) {
  const recent = [...recipes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 7)

  return (
    <div className="toc-page" style={{ 
      padding: '24px 28px',
      color: KAMI.nearBlack,
      fontFamily: KAMI.serif,
      display: 'flex', 
      flexDirection: 'column', 
      gap: 16,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ paddingBottom: 16, borderBottom: `1px solid ${KAMI.border}` }}>
        <p style={{
          fontSize: 11,
          fontFamily: KAMI.mono,
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          color: KAMI.ink,
          fontWeight: 700,
        }}>
          RECENT UPDATES / 最近更新
        </p>
      </div>

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {recent.map((r) => (
          <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ 
              fontSize: 14, 
              fontWeight: 500, 
              color: KAMI.nearBlack, 
              lineHeight: 1.3,
              letterSpacing: '0.01em'
            }}>
              {r.title}
            </p>
            <p style={{ fontSize: 11, color: KAMI.stone, fontFamily: KAMI.mono, letterSpacing: '0.02em' }}>
              v{r.version}
              {' · '}
              {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
              {r.category && ` · ${r.category.toUpperCase()}`}
            </p>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${KAMI.border}` }}>
        <p style={{ 
          fontSize: 12, 
          lineHeight: 1.6, 
          color: KAMI.olive, 
          fontStyle: 'italic',
          fontFamily: KAMI.serif 
        }}>
          “每一道菜都是一次实验，每一次修改都是一段成长。
          翻阅这些记录，不只是找食谱，更是回看学习的轨迹。”
        </p>
      </div>
    </div>
  )
}
