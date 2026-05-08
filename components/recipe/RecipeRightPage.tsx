import type { Recipe } from '@/lib/recipes'
import RecipeSkillGraphPanel from './RecipeSkillGraphPanel'

interface Props {
  recipe: Recipe
}

const ink = 'oklch(0.22 0.03 50)'
const muted = 'oklch(0.52 0.03 50)'
const accent = 'oklch(0.55 0.18 35)'
const accentBg = 'oklch(0.65 0.18 35 / 0.10)'
const rule = '1px solid oklch(0.65 0.18 35 / 0.18)'

function PageLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10,
      fontFamily: 'monospace',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.2em',
      color: muted,
      marginBottom: 10,
      fontWeight: 600,
    }}>
      {children}
    </p>
  )
}

export default function RecipeRightPage({ recipe }: Props) {
  const mutedStyle = { color: muted }

  return (
    <div className="bs-page-scroll-content" style={{ display: 'flex', flexDirection: 'column', gap: 20, color: ink }}>

      {/* ── Tags ── */}
      {recipe.tags.length > 0 && (
        <div>
          <PageLabel>标签</PageLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  letterSpacing: '0.06em',
                  padding: '4px 11px',
                  borderRadius: 100,
                  border: `1px solid oklch(0.65 0.18 35 / 0.35)`,
                  color: accent,
                  background: accentBg,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Proficiency ── */}
      {recipe.proficiency != null && (
        <div>
          <PageLabel>熟练度</PageLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: i < (recipe.proficiency ?? 0)
                    ? accent
                    : 'oklch(0.88 0.02 80)',
                  flexShrink: 0,
                }}
              />
            ))}
            <span style={{ fontSize: 11, color: muted, marginLeft: 4, fontFamily: 'monospace' }}>
              {recipe.proficiency} / 5
            </span>
          </div>
        </div>
      )}

      {/* ── Skill graph ── */}
      <RecipeSkillGraphPanel currentRecipeId={recipe.id} mutedStyle={mutedStyle} />

      {/* ── Suitable occasions ── */}
      {recipe.suitable_occasions.length > 0 && (
        <div>
          <PageLabel>适合场景</PageLabel>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recipe.suitable_occasions.map((occ, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                <span style={{ color: accent, flexShrink: 0, fontSize: 16, lineHeight: 0.85 }}>·</span>
                <span style={{ color: ink, lineHeight: 1.5 }}>{occ}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Failure notes ── */}
      {recipe.failure_notes && (
        <div style={{ borderLeft: `2.5px solid oklch(0.65 0.18 35 / 0.45)`, paddingLeft: 12 }}>
          <PageLabel>失败提醒</PageLabel>
          <p style={{ fontSize: 12, color: muted, lineHeight: 1.7 }}>
            {recipe.failure_notes}
          </p>
        </div>
      )}

      {/* ── Life notes ── */}
      {recipe.life_notes && (
        <div style={{
          padding: '12px 14px',
          background: 'oklch(0.96 0.02 85)',
          borderRadius: 6,
        }}>
          <PageLabel>生活化备注</PageLabel>
          <p style={{ fontSize: 12, color: muted, lineHeight: 1.7, fontStyle: 'italic' }}>
            {recipe.life_notes}
          </p>
        </div>
      )}

      {/* ── Pairing suggestions ── */}
      {recipe.pairing_suggestions && (
        <div>
          <PageLabel>搭配建议</PageLabel>
          <p style={{ fontSize: 12, color: muted, lineHeight: 1.7 }}>
            {recipe.pairing_suggestions}
          </p>
        </div>
      )}

      {/* ── Published date ── */}
      {recipe.published_at && (
        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: rule }}>
          <p style={{ fontSize: 10, color: muted, textAlign: 'right', fontFamily: 'monospace' }}>
            首发于{' '}
            {new Date(recipe.published_at).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      )}
    </div>
  )
}
