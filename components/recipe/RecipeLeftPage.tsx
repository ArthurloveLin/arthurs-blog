import Image from 'next/image'
import type { Recipe, RecipeRevision } from '@/lib/recipes'
import FlavorRadar from './FlavorRadar'
import RevisionTimeline from './RevisionTimeline'

interface Props {
  recipe: Recipe
  revisions: RecipeRevision[]
}

const ink = 'oklch(0.22 0.03 50)'
const muted = 'oklch(0.52 0.03 50)'
const accent = 'oklch(0.55 0.18 35)'
const accentBg = 'oklch(0.65 0.18 35 / 0.12)'
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

export default function RecipeLeftPage({ recipe, revisions }: Props) {
  const definedMetrics = [
    recipe.prep_time_minutes != null && { val: recipe.prep_time_minutes, unit: 'min', label: '备料' },
    recipe.cook_time_minutes != null && { val: recipe.cook_time_minutes, unit: 'min', label: '烹饪' },
    recipe.servings != null && { val: recipe.servings, unit: '', label: '人份' },
  ].filter(Boolean) as { val: number; unit: string; label: string }[]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', color: ink }}>

      {/* ── Header ── */}
      <div style={{ paddingBottom: 14, borderBottom: rule }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {recipe.category && (
              <p style={{
                fontSize: 10,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                color: accent,
                fontWeight: 600,
                marginBottom: 6,
              }}>
                {recipe.category}
              </p>
            )}
            <h2 style={{
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1.15,
              color: ink,
              wordBreak: 'break-word',
              letterSpacing: '-0.01em',
            }}>
              {recipe.title}
            </h2>
          </div>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: accent,
            border: `1px solid oklch(0.65 0.18 35 / 0.4)`,
            padding: '3px 9px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            marginTop: 4,
            flexShrink: 0,
          }}>
            v{recipe.version}
          </span>
        </div>

        {recipe.description && (
          <p style={{
            fontSize: 12,
            color: muted,
            marginTop: 10,
            lineHeight: 1.7,
          }}>
            {recipe.description}
          </p>
        )}
      </div>

      {/* ── Cover image ── */}
      {recipe.cover_image && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '3/2', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
          <Image
            src={recipe.cover_image}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="500px"
          />
        </div>
      )}

      {/* ── Metrics grid ── */}
      {definedMetrics.length > 0 && (
        <div style={{ display: 'flex', border: rule, borderRadius: 5, overflow: 'hidden' }}>
          {definedMetrics.map((m, i) => (
            <div
              key={m.label}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '11px 8px',
                borderRight: i < definedMetrics.length - 1 ? rule : undefined,
              }}
            >
              <p style={{ fontSize: 20, fontWeight: 700, color: ink, lineHeight: 1 }}>
                {m.val}
                {m.unit && <span style={{ fontSize: 10, color: muted, marginLeft: 2 }}>{m.unit}</span>}
              </p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4, fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {m.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Ingredients ── */}
      {recipe.ingredients.length > 0 && (
        <div>
          <PageLabel>食材 · {recipe.ingredients.length}</PageLabel>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                <span style={{ color: accent, fontSize: 18, lineHeight: 0.7, flexShrink: 0, marginBottom: -2 }}>·</span>
                <span style={{ fontWeight: 600, color: ink, flex: 1 }}>{ing.name}</span>
                {(ing.amount || ing.unit) && (
                  <span style={{ color: muted, fontSize: 12, flexShrink: 0 }}>
                    {ing.amount}{ing.unit}
                  </span>
                )}
                {ing.note && (
                  <span style={{ color: muted, fontSize: 11, fontStyle: 'italic' }}>({ing.note})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Steps ── */}
      {recipe.steps.length > 0 && (
        <div>
          <PageLabel>步骤</PageLabel>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {recipe.steps.map((step) => (
              <li key={step.id} style={{ display: 'flex', gap: 10 }}>
                <span style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  background: accentBg,
                  color: accent,
                  marginTop: 1,
                }}>
                  {step.order}
                </span>
                <div style={{ flex: 1 }}>
                  {step.title && (
                    <p style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 3, lineHeight: 1.3 }}>
                      {step.title}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: muted, lineHeight: 1.7 }}>
                    {step.description}
                  </p>
                  {step.tip && (
                    <p style={{ fontSize: 11, color: accent, marginTop: 5, fontStyle: 'italic' }}>
                      ↳ {step.tip}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Flavor radar ── */}
      <div>
        <PageLabel>风味雷达</PageLabel>
        <FlavorRadar recipe={recipe} />
      </div>

      {/* ── Revision log ── */}
      {revisions.length > 0 && (
        <div>
          <PageLabel>修订记录</PageLabel>
          <RevisionTimeline revisions={revisions} />
        </div>
      )}
    </div>
  )
}
