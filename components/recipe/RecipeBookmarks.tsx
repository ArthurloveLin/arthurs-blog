'use client'

import { BookOpen, Pencil, History, Eye, EyeOff, Save, X } from 'lucide-react'

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

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid oklch(0.65 0.18 35 / 0.4)',
    background: 'oklch(0.97 0.02 85)',
    color: 'oklch(0.4 0.08 35)',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 500,
    transition: 'background 0.15s',
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      {/* Bookmark spine label */}
      <div
        className="text-[8px] font-mono tracking-widest uppercase mb-1 flex items-center gap-1"
        style={{ color: 'oklch(0.65 0.18 35)' }}
      >
        <BookOpen size={9} />
        书签
      </div>

      {!isEditing ? (
        <>
          <button style={btnBase} onClick={onEdit} title="编辑此页">
            <Pencil size={9} />
            编辑
          </button>
          <button style={btnBase} onClick={onViewRevisions} title="查看版本历史">
            <History size={9} />
            版本
          </button>
          <button
            style={btnBase}
            onClick={onTogglePublish}
            title={isPublished ? '取消发布' : '发布'}
          >
            {isPublished ? <EyeOff size={9} /> : <Eye size={9} />}
            {isPublished ? '下线' : '发布'}
          </button>
        </>
      ) : (
        <>
          <button
            style={{
              ...btnBase,
              background: isSaving ? 'oklch(0.88 0.06 35)' : 'oklch(0.65 0.18 35)',
              color: 'white',
              border: 'none',
            }}
            onClick={onSave}
            disabled={isSaving}
            title="保存更改"
          >
            <Save size={9} />
            {isSaving ? '保存…' : '保存'}
          </button>
          <button style={btnBase} onClick={onCancel} disabled={isSaving} title="取消编辑">
            <X size={9} />
            取消
          </button>
        </>
      )}

      {error && (
        <p
          className="text-[9px] mt-1 max-w-[80px] leading-tight"
          style={{ color: 'oklch(0.5 0.2 15)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
