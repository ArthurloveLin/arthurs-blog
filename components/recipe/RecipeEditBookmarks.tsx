'use client'

import { Save, X, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface Props {
  isSaving: boolean
  isDeleting?: boolean
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  error: string | null
}

export default function RecipeEditBookmarks({ isSaving, isDeleting = false, onSave, onCancel, onDelete, error }: Props) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  function handleDeleteClick() {
    if (deleteConfirm) {
      onDelete()
      setDeleteConfirm(false)
    } else {
      setDeleteConfirm(true)
    }
  }

  return (
    <div className="bs-control-bookmarks" aria-label="管理书签">
      <div className="bs-control-bookmark-slot">
        <button
          type="button"
          className="bs-control-bookmark"
          data-variant="success"
          onClick={onSave}
          disabled={isSaving || isDeleting}
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
          disabled={isSaving || isDeleting}
          title="取消编辑"
        >
          <X />
          <span>取消</span>
        </button>
      </div>
      <div className="bs-control-bookmark-slot">
        <button
          type="button"
          className="bs-control-bookmark"
          data-variant={deleteConfirm ? 'active' : 'danger'}
          onClick={handleDeleteClick}
          onBlur={() => setDeleteConfirm(false)}
          disabled={isSaving || isDeleting}
          title={deleteConfirm ? '再次点击确认删除' : '删除此食谱'}
        >
          <Trash2 />
          <span>{isDeleting ? '删除中' : deleteConfirm ? '确认' : '删除'}</span>
        </button>
      </div>
      {error && <p className="bs-control-error">{error}</p>}
    </div>
  )
}
