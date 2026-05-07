import type { Recipe, SkillGraphData } from '@/lib/recipes'
import SkillTreeGraph from './SkillTreeGraph'

interface Props {
  recipe: Recipe
  skillGraph: SkillGraphData
}

export default function RecipeRightPage({ recipe, skillGraph }: Props) {
  const pageStyle = { color: 'oklch(0.3 0.02 50)' }
  const mutedStyle = { color: 'oklch(0.55 0.03 50)' }
  const accentStyle = { color: 'oklch(0.55 0.18 35)' }

  // Is this recipe connected in the skill graph?
  const hasSkillLinks =
    skillGraph.links.some(
      (l) => l.source === recipe.id || l.target === recipe.id
    ) || skillGraph.nodes.length > 1

  return (
    <div className="h-full flex flex-col gap-2.5 text-xs overflow-y-auto" style={pageStyle}>

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
            标签
          </p>
          <div className="flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded-full border"
                style={{ borderColor: 'oklch(0.65 0.18 35 / 0.35)', ...accentStyle }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Proficiency */}
      {recipe.proficiency != null && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
            熟练度
          </p>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="text-[13px]"
                style={{ opacity: i < (recipe.proficiency ?? 0) ? 1 : 0.2 }}
              >
                ⭐
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skill graph */}
      {hasSkillLinks && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
            技能图谱
          </p>
          <SkillTreeGraph graph={skillGraph} currentRecipeId={recipe.id} />
        </div>
      )}

      {/* Suitable occasions */}
      {recipe.suitable_occasions.length > 0 && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
            适合场景
          </p>
          <ul className="space-y-0.5">
            {recipe.suitable_occasions.map((occ, i) => (
              <li key={i} className="text-[10px] flex gap-1">
                <span style={mutedStyle}>·</span>
                <span>{occ}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Failure notes */}
      {recipe.failure_notes && (
        <div className="rounded border-l-2 pl-2" style={{ borderColor: 'oklch(0.65 0.18 35 / 0.4)' }}>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={mutedStyle}>
            失败提醒
          </p>
          <p className="text-[10px] leading-relaxed" style={mutedStyle}>
            {recipe.failure_notes}
          </p>
        </div>
      )}

      {/* Life notes */}
      {recipe.life_notes && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={mutedStyle}>
            生活化备注
          </p>
          <p className="text-[10px] leading-relaxed italic" style={mutedStyle}>
            {recipe.life_notes}
          </p>
        </div>
      )}

      {/* Pairing suggestions */}
      {recipe.pairing_suggestions && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={mutedStyle}>
            搭配建议
          </p>
          <p className="text-[10px] leading-relaxed" style={mutedStyle}>
            {recipe.pairing_suggestions}
          </p>
        </div>
      )}

      {/* Published date */}
      {recipe.published_at && (
        <div className="mt-auto pt-2 border-t border-amber-800/15">
          <p className="text-[9px] text-right" style={mutedStyle}>
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
