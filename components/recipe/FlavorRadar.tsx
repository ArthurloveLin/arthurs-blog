import type { Recipe } from '@/lib/recipes'

const AXES = [
  { key: 'flavor_sour',     label: '酸' },
  { key: 'flavor_sweet',    label: '甜' },
  { key: 'flavor_bitter',   label: '苦' },
  { key: 'flavor_spicy',    label: '辣' },
  { key: 'flavor_umami',    label: '鲜' },
  { key: 'flavor_aromatic', label: '香' },
] as const

type AxisKey = typeof AXES[number]['key']

interface Props {
  recipe: Pick<Recipe, AxisKey>
  color?: string
}

export default function FlavorRadar({ recipe, color = 'oklch(0.65 0.18 35)' }: Props) {
  const cx = 80
  const cy = 85
  const r = 58
  const n = AXES.length
  const labelOffset = r + 16

  const angles = Array.from({ length: n }, (_, i) =>
    ((-90 + (360 / n) * i) * Math.PI) / 180
  )

  function point(val: number, idx: number) {
    const ratio = Math.min(Math.max(val / 5, 0), 1)
    return {
      x: cx + ratio * r * Math.cos(angles[idx]),
      y: cy + ratio * r * Math.sin(angles[idx]),
    }
  }

  const hasData = AXES.some((ax) => recipe[ax.key] != null)

  const dataPath = hasData
    ? (() => {
        const pts = AXES.map((ax, i) => point((recipe[ax.key] ?? 0) as number, i))
        return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
      })()
    : null

  return (
    <svg viewBox="0 0 160 170" className="w-full max-w-[160px]">
      {/* Grid rings */}
      {[1, 2, 3, 4, 5].map((level) => {
        const pts = angles.map((_, i) => point(level, i))
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
        return (
          <path
            key={level}
            d={d}
            fill="none"
            stroke="oklch(0.5 0.02 50)"
            strokeWidth="0.6"
            strokeOpacity="0.3"
          />
        )
      })}

      {/* Axis lines */}
      {angles.map((_, i) => {
        const outer = point(5, i)
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
            stroke="oklch(0.5 0.02 50)"
            strokeWidth="0.6"
            strokeOpacity="0.3"
          />
        )
      })}

      {/* Data polygon */}
      {dataPath && (
        <path
          d={dataPath}
          fill={color}
          fillOpacity={0.2}
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      )}

      {/* Axis labels */}
      {AXES.map((ax, i) => {
        const lx = cx + labelOffset * Math.cos(angles[i])
        const ly = cy + labelOffset * Math.sin(angles[i])
        const val = recipe[ax.key]
        return (
          <g key={ax.key}>
            <text
              x={lx.toFixed(1)}
              y={ly.toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill="oklch(0.4 0.03 50)"
              fontWeight="600"
            >
              {ax.label}
            </text>
            {val != null && (
              <text
                x={lx.toFixed(1)}
                y={(ly + 9).toFixed(1)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fill={color}
                fillOpacity="0.8"
              >
                {val}
              </text>
            )}
          </g>
        )
      })}

      {!hasData && (
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fill="oklch(0.6 0.02 50)"
        >
          未设置
        </text>
      )}
    </svg>
  )
}
