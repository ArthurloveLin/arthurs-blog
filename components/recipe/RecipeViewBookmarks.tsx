'use client'

import { Pencil, History, Eye, EyeOff } from 'lucide-react'

interface Props {
  isPublished: boolean
  onEdit: () => void
  onViewRevisions: () => void
  onTogglePublish: () => void
}

export default function RecipeViewBookmarks({ isPublished, onEdit, onViewRevisions, onTogglePublish }: Props) {
  return (
    <div className="bs-control-bookmarks" aria-label="管理书签">
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
    </div>
  )
}
