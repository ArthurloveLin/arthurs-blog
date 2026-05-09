'use client'

import type { useRecipeEditor } from '@/hooks/useRecipeEditor'
import { EditableField } from './InlineEditor'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { pageStyle, mutedStyle, inputStyle, SectionLabel } from './recipe-edit-shared'

type EditorReturn = ReturnType<typeof useRecipeEditor>

interface Props {
  editor: EditorReturn
}

export default function RecipeEditLeftPage({ editor }: Props) {
  const {
    draft,
    setField,
    ingredientActions,
    stepActions,
    changeSummary,
    setChangeSummary,
    versionChanged,
    originalVersion,
  } = editor
  const { addIngredient, removeIngredient, updateIngredient } = ingredientActions
  const { addStep, removeStep, updateStep } = stepActions

  return (
    <div className="bs-page-scroll-content flex flex-col gap-4" style={pageStyle}>
      {/* Title + Rating */}
      <div className="pb-1.5 border-b border-amber-800/20">
        <div className="flex items-center justify-between">
          <SectionLabel>标题</SectionLabel>
          <div className="flex gap-1 items-center">
            <span className="text-[10px] text-amber-800/40 uppercase mr-1">推荐指数</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setField('recommendation_rating', star)}
                className={`text-sm transition-colors ${
                  star <= (draft.recommendation_rating || 0) ? 'text-amber-600' : 'text-amber-200 hover:text-amber-400'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <EditableField
          value={draft.title}
          onChange={(v) => setField('title', v)}
          isEditing
          placeholder="菜名"
          className="text-sm font-bold"
        />
      </div>

      {/* Category + version */}
      <div className="flex gap-2">
        <div className="flex-1">
          <SectionLabel>分类</SectionLabel>
          <EditableField
            value={draft.category}
            onChange={(v) => setField('category', v)}
            isEditing
            placeholder="例：家常菜"
          />
        </div>
        <div className="w-16">
          <SectionLabel>版本</SectionLabel>
          <EditableField
            value={draft.version}
            onChange={(v) => setField('version', v)}
            isEditing
            placeholder="1.0"
          />
        </div>
      </div>

      <div className="rounded border border-amber-800/20 bg-amber-50/45 px-2.5 py-2">
        <SectionLabel>版本说明</SectionLabel>
        <p className="text-[10px] leading-relaxed mb-1.5" style={mutedStyle}>
          只有改动版本号时，当前内容才会被归档为旧版本。发布和下线只影响公开可见性，不会自动归档。
        </p>
        <EditableField
          value={changeSummary}
          onChange={setChangeSummary}
          isEditing
          type="textarea"
          placeholder={versionChanged ? '例如：调整火候，补充失败提醒，升级到 v1.1' : '版本未变更时可留空'}
        />
        {versionChanged && (
          <p className="text-[9px] mt-1 text-amber-900/60">
            保存后会把当前的 v{originalVersion} 内容归档为旧版本。
          </p>
        )}
      </div>

      {/* Metrics */}
      <div className="flex gap-2">
        <div className="flex-1">
          <SectionLabel>备料(分钟)</SectionLabel>
          <EditableField
            value={draft.prep_time_minutes}
            onChange={(v) => setField('prep_time_minutes', v ? parseInt(v) : null)}
            isEditing
            type="number"
            placeholder="15"
          />
        </div>
        <div className="flex-1">
          <SectionLabel>烹饪(分钟)</SectionLabel>
          <EditableField
            value={draft.cook_time_minutes}
            onChange={(v) => setField('cook_time_minutes', v ? parseInt(v) : null)}
            isEditing
            type="number"
            placeholder="30"
          />
        </div>
        <div className="flex-1">
          <SectionLabel>人份</SectionLabel>
          <EditableField
            value={draft.servings}
            onChange={(v) => setField('servings', v ? parseInt(v) : null)}
            isEditing
            type="number"
            placeholder="2"
          />
        </div>
      </div>

      {/* Gallery */}
      <div>
        <SectionLabel>菜品照片 (第一张将作为封面)</SectionLabel>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {(draft.gallery_images || []).map((img, idx) => (
            <div key={img.key} className="relative aspect-square rounded overflow-hidden border border-amber-800/10 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
              <button
                onClick={async () => {
                  if (confirm('确定要删除这张照片吗？此操作也会从云端删除文件。')) {
                    try {
                      const res = await fetch('/api/admin/delete-recipe-image', {
                        method: 'POST',
                        body: JSON.stringify({ key: img.key }),
                      })
                      if (res.ok) editor.galleryActions.removeGalleryImage(img.key)
                    } catch (e) {
                      console.error('Delete failed', e)
                    }
                  }
                }}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-amber-800/20 rounded cursor-pointer hover:bg-amber-50 transition-colors">
            <Plus size={20} className="text-amber-800/40" />
            <span className="text-[10px] text-amber-800/40 mt-1">上传照片</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files
                if (!files) return
                
                const { compressImage } = await import('@/lib/compress')
                
                for (const file of Array.from(files)) {
                  try {
                    // Compress client-side
                    const compressedFile = await compressImage(file)
                    
                    const formData = new FormData()
                    formData.append('file', compressedFile)
                    formData.append('recipeSlug', draft.slug)
                    
                    const res = await fetch('/api/admin/upload-recipe-image', {
                      method: 'POST',
                      body: formData,
                    })
                    if (res.ok) {
                      const data = await res.json()
                      editor.galleryActions.addGalleryImage({ url: data.url, key: data.key })
                    }
                  } catch (err) {
                    console.error('Upload failed', err)
                  }
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Description */}
      <div>
        <SectionLabel>简介</SectionLabel>
        <EditableField
          value={draft.description}
          onChange={(v) => setField('description', v)}
          isEditing
          type="textarea"
          placeholder="这道菜的故事…"
        />
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel>食材</SectionLabel>
          <button
            onClick={addIngredient}
            style={{ color: 'oklch(0.55 0.18 35)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <Plus size={11} /> 添加
          </button>
        </div>
        <div className="space-y-1.5">
          {draft.ingredients.map((ing) => (
            <div key={ing.id} className="flex items-center gap-1.5">
              <GripVertical size={11} style={mutedStyle} />
              <input
                value={ing.name}
                onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                placeholder="食材名"
                style={{ flex: 2, ...inputStyle }}
              />
              <input
                value={ing.amount}
                onChange={(e) => updateIngredient(ing.id, { amount: e.target.value })}
                placeholder="用量"
                style={{ flex: 1, ...inputStyle }}
              />
              <input
                value={ing.unit}
                onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })}
                placeholder="单位"
                style={{ flex: 1, ...inputStyle }}
              />
              <button onClick={() => removeIngredient(ing.id)}>
                <Trash2 size={11} style={{ color: 'oklch(0.5 0.15 15)' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel>步骤</SectionLabel>
          <button
            onClick={addStep}
            style={{ color: 'oklch(0.55 0.18 35)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <Plus size={11} /> 添加
          </button>
        </div>
        <div className="space-y-2">
          {draft.steps.map((step, i) => (
            <div key={step.id} className="flex gap-1.5 items-start">
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5"
                style={{ background: 'oklch(0.65 0.18 35 / 0.15)', color: 'oklch(0.55 0.18 35)' }}
              >
                {i + 1}
              </span>
              <div className="flex-1 space-y-1">
                <input
                  value={step.title}
                  onChange={(e) => updateStep(step.id, { title: e.target.value })}
                  placeholder="步骤标题（可选）"
                  style={{ width: '100%', ...inputStyle }}
                />
                <textarea
                  value={step.description}
                  onChange={(e) => updateStep(step.id, { description: e.target.value })}
                  placeholder="步骤描述…"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical', ...inputStyle }}
                />
              </div>
              <button onClick={() => removeStep(step.id)}>
                <Trash2 size={11} style={{ color: 'oklch(0.5 0.15 15)' }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
