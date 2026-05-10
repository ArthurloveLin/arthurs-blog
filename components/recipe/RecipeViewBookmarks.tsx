'use client'

import { Pencil, History, Eye, EyeOff } from 'lucide-react'
import RecipeDesktopThemeBookmarkSlot from './RecipeDesktopThemeBookmark'

interface Props {
  isPublished: boolean
  onEdit: () => void
  onViewRevisions: () => void
  onTogglePublish: () => void
  isPublishPending?: boolean
  isViewingRevisions?: boolean
}

export default function RecipeViewBookmarks({
  isPublished,
  onEdit,
  onViewRevisions,
  onTogglePublish,
  isPublishPending = false,
  isViewingRevisions = false,
}: Props) {
  return (
    <div className="bs-control-bookmarks" aria-label="管理书签">
      <RecipeDesktopThemeBookmarkSlot />
      <div className="bs-control-bookmark-slot">
        <button type="button" className="bs-control-bookmark" onClick={onEdit} title="编辑此页" disabled={isPublishPending}>
          <Pencil />
          <span>编辑</span>
        </button>
      </div>
      <div className="bs-control-bookmark-slot">
        <button
          type="button"
          className="bs-control-bookmark"
          data-variant={isViewingRevisions ? 'active' : 'muted'}
          onClick={onViewRevisions}
          title={isViewingRevisions ? '返回当前版本' : '查看版本历史'}
          disabled={isPublishPending}
        >
          <History />
          <span>{isViewingRevisions ? '返回' : '版本'}</span>
        </button>
      </div>
      <div className="bs-control-bookmark-slot">
        <button
          type="button"
          className="bs-control-bookmark"
          data-variant={isPublished ? 'danger' : 'success'}
          onClick={onTogglePublish}
          title={isPublished ? '取消发布' : '发布'}
          disabled={isPublishPending}
        >
          {isPublished ? <EyeOff /> : <Eye />}
          <span>{isPublishPending ? '处理中' : isPublished ? '下线' : '发布'}</span>
        </button>
      </div>
    </div>
  )
}
