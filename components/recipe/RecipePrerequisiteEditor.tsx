'use client'

import { useCallback, useMemo, useReducer, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, ChevronDown } from 'lucide-react'
import { useRecipeSkillGraph } from './RecipeSkillGraphProvider'
import { SectionLabel, inputStyle } from './recipe-edit-shared'

interface Props {
  recipeId: string
}

interface AddForm {
  direction: 'prereq' | 'continuation'
  targetId: string
  skillLabel: string
}

const initialForm: AddForm = { direction: 'prereq', targetId: '', skillLabel: '' }

type Action =
  | { type: 'set_direction'; value: 'prereq' | 'continuation' }
  | { type: 'set_target'; value: string }
  | { type: 'set_label'; value: string }
  | { type: 'reset' }

function formReducer(state: AddForm, action: Action): AddForm {
  switch (action.type) {
    case 'set_direction': return { ...state, direction: action.value, targetId: '' }
    case 'set_target': return { ...state, targetId: action.value }
    case 'set_label': return { ...state, skillLabel: action.value }
    case 'reset': return initialForm
  }
}

const mutedColor = 'oklch(0.55 0.03 50)'
const accentColor = 'oklch(0.65 0.18 35)'

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  paddingRight: 24,
  cursor: 'pointer',
  backgroundImage: 'none',
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: mutedColor,
  fontFamily: 'monospace',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 3,
}

export default function RecipePrerequisiteEditor({ recipeId }: Props) {
  const router = useRouter()
  const { graph } = useRecipeSkillGraph()
  const [isPending, startTransition] = useTransition()
  const [isAdding, setIsAdding] = useReducer((s: boolean) => !s, false)
  const [form, dispatch] = useReducer(formReducer, initialForm)
  const [error, setError] = useReducer((_: string | null, v: string | null) => v, null)

  const prerequisites = useMemo(
    () =>
      graph.links
        .filter((l) => String(l.target) === recipeId)
        .map((l) => {
          const node = graph.nodes.find((n) => n.id === String(l.source))
          return node ? { linkId: l.id, node, skillLabel: l.skill_label } : null
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    [graph, recipeId]
  )

  const continuations = useMemo(
    () =>
      graph.links
        .filter((l) => String(l.source) === recipeId)
        .map((l) => {
          const node = graph.nodes.find((n) => n.id === String(l.target))
          return node ? { linkId: l.id, node, skillLabel: l.skill_label } : null
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    [graph, recipeId]
  )

  const availableNodes = useMemo(() => {
    const linked = new Set(
      form.direction === 'prereq'
        ? prerequisites.map((p) => p.node.id)
        : continuations.map((c) => c.node.id)
    )
    return graph.nodes.filter((n) => n.id !== recipeId && !linked.has(n.id))
  }, [graph.nodes, recipeId, form.direction, prerequisites, continuations])

  const removeLink = useCallback(
    async (linkId: string) => {
      setError(null)
      try {
        const res = await fetch(`/api/recipes/prerequisites/${linkId}`, { method: 'DELETE' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        startTransition(() => { router.refresh() })
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除失败')
      }
    },
    [router, startTransition]
  )

  const addLink = useCallback(
    async () => {
      if (!form.targetId || !form.skillLabel.trim()) {
        setError('请选择菜谱并填写技能标签')
        return
      }
      setError(null)
      const body =
        form.direction === 'prereq'
          ? { from_recipe_id: form.targetId, to_recipe_id: recipeId, skill_label: form.skillLabel.trim() }
          : { from_recipe_id: recipeId, to_recipe_id: form.targetId, skill_label: form.skillLabel.trim() }
      try {
        const res = await fetch('/api/recipes/prerequisites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload.error ?? `HTTP ${res.status}`)
        }
        dispatch({ type: 'reset' })
        setIsAdding()
        startTransition(() => { router.refresh() })
      } catch (err) {
        setError(err instanceof Error ? err.message : '添加失败')
      }
    },
    [form, recipeId, router, startTransition]
  )

  return (
    <div style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.15s' }}>
      <SectionLabel>技能关联</SectionLabel>

      {/* Prerequisites */}
      <div className="mb-3">
        <p className="mb-1.5" style={{ fontSize: 10, color: mutedColor, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          前置 ({prerequisites.length})
        </p>
        {prerequisites.length === 0 ? (
          <p style={{ fontSize: 11, color: mutedColor }}>暂无</p>
        ) : (
          <div className="space-y-1.5">
            {prerequisites.map(({ linkId, node, skillLabel }) => (
              <div
                key={linkId}
                className="flex items-start gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'oklch(0.96 0.01 80)', border: '1px solid oklch(0.88 0.02 80)' }}
              >
                <button
                  type="button"
                  onClick={() => removeLink(linkId)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition hover:opacity-70"
                  style={{ background: 'oklch(0.65 0.18 35 / 0.15)', color: accentColor }}
                  aria-label="移除"
                >
                  <X size={10} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" style={{ fontSize: 11, color: 'oklch(0.35 0.02 50)' }}>
                    {node.title}
                  </p>
                  <p className="mt-0.5 truncate" style={{ fontSize: 10, color: mutedColor }}>
                    ↑ {skillLabel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Continuations */}
      <div className="mb-3">
        <p className="mb-1.5" style={{ fontSize: 10, color: mutedColor, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          后续 ({continuations.length})
        </p>
        {continuations.length === 0 ? (
          <p style={{ fontSize: 11, color: mutedColor }}>暂无</p>
        ) : (
          <div className="space-y-1.5">
            {continuations.map(({ linkId, node, skillLabel }) => (
              <div
                key={linkId}
                className="flex items-start gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'oklch(0.96 0.01 80)', border: '1px solid oklch(0.88 0.02 80)' }}
              >
                <button
                  type="button"
                  onClick={() => removeLink(linkId)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition hover:opacity-70"
                  style={{ background: 'oklch(0.65 0.18 35 / 0.15)', color: accentColor }}
                  aria-label="移除"
                >
                  <X size={10} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" style={{ fontSize: 11, color: 'oklch(0.35 0.02 50)' }}>
                    {node.title}
                  </p>
                  <p className="mt-0.5 truncate" style={{ fontSize: 10, color: mutedColor }}>
                    ↓ {skillLabel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      {isAdding ? (
        <div
          className="rounded-lg p-3 space-y-2.5"
          style={{ borderColor: 'oklch(0.65 0.18 35 / 0.25)', background: 'oklch(0.97 0.01 85)', border: '1px solid oklch(0.65 0.18 35 / 0.2)' }}
        >
          {/* Direction */}
          <div>
            <p style={fieldLabelStyle}>关联方向</p>
            <div className="relative">
              <select
                value={form.direction}
                onChange={(e) => dispatch({ type: 'set_direction', value: e.target.value as 'prereq' | 'continuation' })}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="prereq">前置（其他菜 → 本菜）</option>
                <option value="continuation">后续（本菜 → 其他菜）</option>
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: mutedColor, pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Target recipe */}
          <div>
            <p style={fieldLabelStyle}>目标菜谱</p>
            <div className="relative">
              <select
                value={form.targetId}
                onChange={(e) => dispatch({ type: 'set_target', value: e.target.value })}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="">选择菜谱…</option>
                {availableNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: mutedColor, pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Skill label */}
          <div>
            <p style={fieldLabelStyle}>技能标签</p>
            <input
              type="text"
              placeholder="如「焯水」「煸炒」"
              value={form.skillLabel}
              onChange={(e) => dispatch({ type: 'set_label', value: e.target.value })}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 11, color: 'oklch(0.55 0.18 25)' }}>{error}</p>
          )}

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={addLink}
              className="flex-1 rounded-md py-1 text-center transition hover:opacity-80"
              style={{ fontSize: 11, background: 'oklch(0.65 0.18 35 / 0.18)', color: accentColor, border: '1px solid oklch(0.65 0.18 35 / 0.3)' }}
            >
              确认添加
            </button>
            <button
              type="button"
              onClick={() => { setIsAdding(); dispatch({ type: 'reset' }); setError(null) }}
              className="flex-1 rounded-md py-1 text-center transition hover:opacity-80"
              style={{ fontSize: 11, background: 'oklch(0.92 0.01 80)', color: mutedColor, border: '1px solid oklch(0.85 0.01 80)' }}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={setIsAdding}
          className="flex items-center gap-1.5 transition hover:opacity-70"
          style={{ fontSize: 11, color: accentColor }}
        >
          <Plus size={12} />
          添加关联
        </button>
      )}

      {error && !isAdding && (
        <p className="mt-1.5" style={{ fontSize: 11, color: 'oklch(0.55 0.18 25)' }}>{error}</p>
      )}
    </div>
  )
}
