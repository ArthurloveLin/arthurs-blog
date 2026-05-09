import type { Recipe } from '@/lib/recipes'
import RecipeSkillGraphPanel from './RecipeSkillGraphPanel'

interface Props {
  recipe: Recipe
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: KAMI.serif,
      fontSize: 14,
      fontWeight: 500,
      color: KAMI.nearBlack,
      margin: '20px 0 10px 0',
      borderLeft: `2.5px solid ${KAMI.ink}`,
      paddingLeft: 8,
      letterSpacing: '0.05em',
    }}>
      {children}
    </h3>
  )
}

export default function RecipeRightPage({ recipe }: Props) {
  const mutedStyle = { color: KAMI.stone }

  return (
    <div className="bs-page-scroll-content" style={{ 
      padding: '24px 28px',
      color: KAMI.nearBlack,
      fontFamily: KAMI.serif,
      display: 'flex', 
      flexDirection: 'column', 
      gap: 20,
      height: '100%',
    }}>


      {/* ── Skill graph ── */}
      <section>
        <SectionTitle>技能分布</SectionTitle>
        <div style={{ transform: 'scale(0.95)', transformOrigin: 'top left' }}>
          <RecipeSkillGraphPanel currentRecipeId={recipe.id} mutedStyle={mutedStyle} />
        </div>
      </section>

      {/* ── Suitable occasions ── */}
      {recipe.suitable_occasions.length > 0 && (
        <section>
          <SectionTitle>适用场景</SectionTitle>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recipe.suitable_occasions.map((occ, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, borderBottom: `0.5px solid ${KAMI.borderSoft}`, paddingBottom: 4 }}>
                <span style={{ color: KAMI.ink, flexShrink: 0, fontSize: 13.5, lineHeight: 1 }}>·</span>
                <span style={{ color: KAMI.nearBlack, lineHeight: 1.4 }}>{occ}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Failure notes ── */}
      {recipe.failure_notes && (
        <section>
          <SectionTitle>失败提醒</SectionTitle>
          <p style={{ fontSize: 12, color: KAMI.olive, lineHeight: 1.6 }}>
            {recipe.failure_notes}
          </p>
        </section>
      )}

      {/* ── Life notes ── */}
      {recipe.life_notes && (
        <section>
          <SectionTitle>随笔备注</SectionTitle>
          <p style={{ 
            fontSize: 12, 
            color: KAMI.olive, 
            lineHeight: 1.6, 
            fontStyle: 'italic',
            paddingLeft: 10,
            borderLeft: `1.5px solid ${KAMI.borderSoft}`
          }}>
            {recipe.life_notes}
          </p>
        </section>
      )}

      {/* ── Pairing suggestions ── */}
      {recipe.pairing_suggestions && (
        <section>
          <SectionTitle>搭配建议</SectionTitle>
          <p style={{ fontSize: 12, color: KAMI.olive, lineHeight: 1.6 }}>
            {recipe.pairing_suggestions}
          </p>
        </section>
      )}

      {/* ── Published date ── */}
      {recipe.published_at && (
        <footer style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${KAMI.border}` }}>
          <p style={{ fontSize: 10.5, color: KAMI.stone, textAlign: 'right', fontFamily: KAMI.mono }}>
            PUBLISHED ON {' '}
            {new Date(recipe.published_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }).toUpperCase()}
          </p>
        </footer>
      )}
    </div>
  )
}
