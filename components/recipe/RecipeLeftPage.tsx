import Image from 'next/image'
import type { Recipe, RecipeRevision } from '@/lib/recipes'
import FlavorRadar from './FlavorRadar'
import RevisionTimeline from './RevisionTimeline'

interface Props {
  recipe: Recipe
  revisions: RecipeRevision[]
}

export default function RecipeLeftPage({ recipe, revisions }: Props) {
  const pageStyle = { color: 'oklch(0.3 0.02 50)' }
  const mutedStyle = { color: 'oklch(0.55 0.03 50)' }
  const accentStyle = { color: 'oklch(0.55 0.18 35)' }

  return (
    <div className="h-full flex flex-col gap-2.5 text-xs overflow-y-auto" style={pageStyle}>

      {/* Header: title + version */}
      <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-amber-800/20">
        <div>
          <h2 className="text-sm font-bold leading-tight">{recipe.title}</h2>
          {recipe.category && (
            <p className="text-[10px] mt-0.5" style={mutedStyle}>{recipe.category}</p>
          )}
        </div>
        <span
          className="text-[9px] font-mono shrink-0 mt-0.5 px-1.5 py-0.5 rounded border"
          style={{ borderColor: 'oklch(0.65 0.18 35 / 0.4)', ...accentStyle }}
        >
          v{recipe.version}
        </span>
      </div>

      {/* Cover image */}
      {recipe.cover_image && (
        <div className="relative w-full aspect-[3/2] rounded overflow-hidden shrink-0">
          <Image
            src={recipe.cover_image}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="280px"
          />
        </div>
      )}

      {/* Description */}
      {recipe.description && (
        <p className="text-[10px] leading-relaxed" style={mutedStyle}>
          {recipe.description}
        </p>
      )}

      {/* Metrics row */}
      {(recipe.prep_time_minutes || recipe.cook_time_minutes || recipe.servings) && (
        <div className="flex gap-3 text-[10px]" style={mutedStyle}>
          {recipe.prep_time_minutes && (
            <span>备料 {recipe.prep_time_minutes} 分钟</span>
          )}
          {recipe.cook_time_minutes && (
            <span>烹饪 {recipe.cook_time_minutes} 分钟</span>
          )}
          {recipe.servings && (
            <span>{recipe.servings} 人份</span>
          )}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
            食材
          </p>
          <ul className="space-y-px">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex gap-1 text-[10px]">
                <span className="shrink-0 w-4 text-right" style={mutedStyle}>·</span>
                <span className="font-medium">{ing.name}</span>
                {(ing.amount || ing.unit) && (
                  <span style={mutedStyle}>{ing.amount}{ing.unit}</span>
                )}
                {ing.note && (
                  <span style={{ ...mutedStyle, fontStyle: 'italic' }}>({ing.note})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
            步骤
          </p>
          <ol className="space-y-1">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-1.5 text-[10px]">
                <span
                  className="shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold mt-px"
                  style={{ background: 'oklch(0.65 0.18 35 / 0.15)', ...accentStyle }}
                >
                  {step.order}
                </span>
                <div>
                  {step.title && <span className="font-medium">{step.title} </span>}
                  <span style={mutedStyle}>{step.description}</span>
                  {step.tip && (
                    <span className="block text-[9px] mt-0.5" style={{ ...mutedStyle, fontStyle: 'italic' }}>
                      💡 {step.tip}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Flavor radar */}
      <div>
        <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
          风味雷达
        </p>
        <FlavorRadar recipe={recipe} />
      </div>

      {/* Version log */}
      {revisions.length > 0 && (
        <div>
          <p className="text-[9px] font-mono tracking-widest uppercase mb-1" style={mutedStyle}>
            修订记录
          </p>
          <RevisionTimeline revisions={revisions} />
        </div>
      )}
    </div>
  )
}
