'use client'

import { Pencil, History, Eye, EyeOff, Save, X } from 'lucide-react'

interface RecipeBookmarksProps {
  isAdmin: boolean
  isEditing: boolean
  isSaving: boolean
  isPublished: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onTogglePublish: () => void
  onViewRevisions: () => void
  error: string | null
}

export default function RecipeBookmarks({
  isAdmin,
  isEditing,
  isSaving,
  isPublished,
  onEdit,
  onCancel,
  onSave,
  onTogglePublish,
  onViewRevisions,
  error,
}: RecipeBookmarksProps) {
  if (!isAdmin) return null

  return (
    <div className="bs-control-bookmarks" aria-label="管理书签">
      {!isEditing ? (
        <>
          <button type="button" className="bs-control-bookmark" onClick={onEdit} title="编辑此页">
            <Pencil />
            <span>编辑</span>
          </button>
          <button
            type="button"
            className="bs-control-bookmark"
            data-variant="muted"
            onClick={onViewRevisions}
            title="查看版本历史"
          >
            <History />
            <span>版本</span>
          </button>
          <button
            type="button"
            className="bs-control-bookmark"
            data-variant={isPublished ? 'danger' : 'success'}
            onClick={onTogglePublish}
            title={isPublished ? '取消发布' : '发布'}
          >
            {isPublished ? <EyeOff /> : <Eye />}
            <span>{isPublished ? '下线' : '发布'}</span>
          </button>
        </>
      ) : (
        <>
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
        </>
      )}

      {error && <p className="bs-control-error">{error}</p>}
    </div>
  )
}
