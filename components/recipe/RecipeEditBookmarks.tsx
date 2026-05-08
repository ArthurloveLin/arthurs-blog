'use client'

import { Save, X } from 'lucide-react'

interface Props {
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
  error: string | null
}

export default function RecipeEditBookmarks({ isSaving, onSave, onCancel, error }: Props) {
  return (
    <div className="bs-control-bookmarks" aria-label="管理书签">
      <div className="bs-control-bookmark-slot">
        <button
          type="button"
          className="bs-control-bookmark"
          data-variant="success"
          onClick={onSave}
          disabled={isSaving}
          title="保存更改"
        >
          <Save />
          <span>{isSaving ? '保存中' : '保存'}</span>
        </button>
      </div>
      <div className="bs-control-bookmark-slot">
        <button
          type="button"
          className="bs-control-bookmark"
          data-variant="muted"
          onClick={onCancel}
          disabled={isSaving}
          title="取消编辑"
        >
          <X />
          <span>取消</span>
        </button>
      </div>
      {error && <p className="bs-control-error">{error}</p>}
    </div>
  )
}
