'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useRecipeEditor } from '@/hooks/useRecipeEditor'
import type { Recipe } from '@/lib/recipes'
import BookSpread from './BookSpread'
import RecipeRevisionArchive from './RecipeRevisionArchive'
import RecipeViewBookmarks from './RecipeViewBookmarks'
import RecipeEditBookmarks from './RecipeEditBookmarks'
import RecipeEditLeftPage from './RecipeEditLeftPage'
import RecipeEditRightPage from './RecipeEditRightPage'
import type { RecipeRevisionPreview } from './revision-preview'

interface Props {
  recipe: Recipe
  revisionPreviews: RecipeRevisionPreview[]
  condensedLeftPage: React.ReactNode
  rightPage: React.ReactNode
}

function RecipeRevisionPlaceholder({
  selectedRevision,
  revisionCount,
}: {
  selectedRevision: RecipeRevisionPreview | null
  revisionCount: number
}) {
  return (
    <div className="h-full flex flex-col justify-center rounded border border-dashed border-amber-800/25 px-4 text-center text-[11px] leading-relaxed text-amber-900/65">
      {revisionCount === 0
        ? '还没有旧版本可回顾。下次保存时调整版本号并填写变更说明，当前内容就会被归档到这里。'
        : selectedRevision
          ? `v${selectedRevision.version} 还没有完整快照，所以目前无法还原成旧版本书页。`
          : '请选择一个旧版本开始回顾。'}
    </div>
  )
}

export default function RecipeSpreadClient({
  recipe,
  revisionPreviews,
  condensedLeftPage,
  rightPage,
}: Props) {
  const router = useRouter()
  const [showAllRevisions, setShowAllRevisions] = useState(false)
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(revisionPreviews[0]?.id ?? null)
  const [isEditing, setIsEditing] = useState(false)
  const [isPublished, setIsPublished] = useState(recipe.published)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPending, startTransition] = useTransition()

  const editor = useRecipeEditor({
    recipe,
    onSaved: () => setIsEditing(false),
  })

  const selectedRevision = revisionPreviews.find((r) => r.id === selectedRevisionId) ?? revisionPreviews[0] ?? null

  function handleStartEdit() {
    // Reset draft from current recipe prop before entering edit mode,
    // so cancelled edits don't bleed into the next session.
    editor.startEditing()
    setIsEditing(true)
  }

  function handleCancelEdit() {
    editor.cancelEditing()
    setIsEditing(false)
  }

  function togglePublish() {
    startTransition(async () => {
      const nextPublished = !isPublished
      const res = await fetch(`/api/recipes/${recipe.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: nextPublished }),
      })

      if (res.ok) {
        setIsPublished(nextPublished)
        router.refresh()
      }
    })
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/recipes/${recipe.slug}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Always render a single BookSpread so the .rt-page DOM nodes stay stable.
  // Switching component types (e.g. RecipeViewingSpread → RecipeSpreadEditor) would cause
  // React to call removeChild on .rt-page elements that turn.js has already moved into
  // its own wrapper divs, producing a NotFoundError.
  const left = isEditing
    ? <RecipeEditLeftPage editor={editor} />
    : showAllRevisions
      ? (
          <RecipeRevisionArchive
            currentVersion={recipe.version}
            isPublished={isPublished}
            revisions={revisionPreviews}
            selectedRevisionId={selectedRevision?.id ?? null}
            onSelectRevision={setSelectedRevisionId}
          />
        )
      : condensedLeftPage

  const right = isEditing
    ? <RecipeEditRightPage editor={editor} />
    : showAllRevisions
      ? (selectedRevision?.rightPage ?? (
          <RecipeRevisionPlaceholder
            selectedRevision={selectedRevision}
            revisionCount={revisionPreviews.length}
          />
        ))
      : rightPage

  const overlay = isEditing
    ? (
        <RecipeEditBookmarks
          isSaving={editor.isSaving}
          isDeleting={isDeleting}
          onSave={editor.save}
          onCancel={handleCancelEdit}
          onDelete={handleDelete}
          error={editor.error}
        />
      )
    : (
        <RecipeViewBookmarks
          isPublished={isPublished}
          onEdit={handleStartEdit}
          onViewRevisions={() => setShowAllRevisions((v) => !v)}
          onTogglePublish={togglePublish}
          isPublishPending={isPending}
          isViewingRevisions={showAllRevisions}
        />
      )

  return <BookSpread left={left} right={right} rightOverlay={overlay} />
}
