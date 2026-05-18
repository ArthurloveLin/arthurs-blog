'use client'

import type { useRecipeEditor } from '@/hooks/useRecipeEditor'
import { EditableField, EditableTags } from './InlineEditor'
import { pageStyle, SectionLabel, StarRating, DotRating } from './recipe-edit-shared'
import RecipePrerequisiteEditor from './RecipePrerequisiteEditor'

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
    <div className="bs-page-scroll-content recipe-edit-page recipe-edit-right-content flex flex-col gap-4 pr-16" style={pageStyle}>

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
        <SectionLabel>熟练度</SectionLabel>
        <StarRating
          value={draft.proficiency}
          onChange={(v) => setField('proficiency', v)}
        />
      </div>

      {/* Flavor radar */}
      <div>
        <SectionLabel>风味雷达</SectionLabel>
        <div className="recipe-edit-flavor-grid grid grid-cols-2 gap-x-4 gap-y-3 mt-1">
          {flavorKeys.map(({ key, label }) => (
            <DotRating
              key={key}
              label={label}
              value={draft[key]}
              onChange={(v) => setField(key, v)}
            />
          ))}
        </div>
      </div>

      {/* Prerequisites */}
      <div>
        <RecipePrerequisiteEditor recipeId={editor.recipeId} />
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
