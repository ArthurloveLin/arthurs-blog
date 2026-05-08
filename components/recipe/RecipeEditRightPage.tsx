'use client'

import type { useRecipeEditor } from '@/hooks/useRecipeEditor'
import { EditableField, EditableTags } from './InlineEditor'
import { pageStyle, inputStyle, SectionLabel } from './recipe-edit-shared'

type EditorReturn = ReturnType<typeof useRecipeEditor>

const flavorKeys = [
  { key: 'flavor_sour' as const,     label: '酸' },
  { key: 'flavor_sweet' as const,    label: '甜' },
  { key: 'flavor_bitter' as const,   label: '苦' },
  { key: 'flavor_spicy' as const,    label: '辣' },
  { key: 'flavor_umami' as const,    label: '鲜' },
  { key: 'flavor_aromatic' as const, label: '香' },
]

interface Props {
  editor: EditorReturn
}

export default function RecipeEditRightPage({ editor }: Props) {
  const { draft, setField } = editor

  return (
    <div className="h-full flex flex-col gap-2.5 text-xs overflow-y-auto pr-14" style={pageStyle}>

      {/* Tags */}
      <div>
        <SectionLabel>标签</SectionLabel>
        <EditableTags
          tags={draft.tags}
          onChange={(v) => setField('tags', v)}
          isEditing
        />
      </div>

      {/* Proficiency */}
      <div>
        <SectionLabel>熟练度 (1-5)</SectionLabel>
        <input
          type="number"
          min={1} max={5}
          value={draft.proficiency ?? ''}
          onChange={(e) => setField('proficiency', e.target.value ? parseInt(e.target.value) : null)}
          style={{ width: 48, ...inputStyle }}
        />
      </div>

      {/* Flavor radar */}
      <div>
        <SectionLabel>风味雷达 (0-5，空=未设置)</SectionLabel>
        <div className="grid grid-cols-3 gap-1">
          {flavorKeys.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1">
              <span style={{ color: 'oklch(0.55 0.03 50)', width: 12 }}>{label}</span>
              <input
                type="number"
                min={0} max={5}
                value={draft[key] ?? ''}
                onChange={(e) => setField(key, e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: 32, ...inputStyle }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Suitable occasions */}
      <div>
        <SectionLabel>适合场景（逗号分隔）</SectionLabel>
        <EditableTags
          tags={draft.suitable_occasions}
          onChange={(v) => setField('suitable_occasions', v)}
          isEditing
        />
      </div>

      {/* Failure notes */}
      <div>
        <SectionLabel>失败提醒</SectionLabel>
        <EditableField
          value={draft.failure_notes}
          onChange={(v) => setField('failure_notes', v)}
          isEditing
          type="textarea"
          placeholder="容易踩的坑…"
        />
      </div>

      {/* Life notes */}
      <div>
        <SectionLabel>生活化备注</SectionLabel>
        <EditableField
          value={draft.life_notes}
          onChange={(v) => setField('life_notes', v)}
          isEditing
          type="textarea"
          placeholder="适合周末家宴…"
        />
      </div>

      {/* Pairing suggestions */}
      <div>
        <SectionLabel>搭配建议</SectionLabel>
        <EditableField
          value={draft.pairing_suggestions}
          onChange={(v) => setField('pairing_suggestions', v)}
          isEditing
          type="textarea"
          placeholder="搭配白米饭…"
        />
      </div>
    </div>
  )
}
