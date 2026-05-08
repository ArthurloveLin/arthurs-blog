'use client'

import dynamic from 'next/dynamic'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import BookSpread from './BookSpread'
import RecipeRevisionArchive from './RecipeRevisionArchive'
import RecipeViewBookmarks from './RecipeViewBookmarks'
import RecipeSpreadSkeleton from './RecipeSpreadSkeleton'
import type { RecipeRevisionPreview } from './revision-preview'

interface Props {
  slug: string
  initialPublished: boolean
  currentVersion: string
  revisionPreviews: RecipeRevisionPreview[]
  condensedLeftPage: React.ReactNode
  rightPage: React.ReactNode
}

const RecipeSpreadEditor = dynamic(() => import('./RecipeSpreadEditor'), {
  ssr: false,
  loading: () => <RecipeSpreadSkeleton />,
})

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

function RecipeViewingSpread({
  currentVersion,
  revisionPreviews,
  selectedRevision,
  condensedLeftPage,
  rightPage,
  onEdit,
  onTogglePublish,
  showAllRevisions,
  onToggleRevisions,
  onSelectRevision,
  isPublished,
  isPublishPending,
}: {
  currentVersion: string
  revisionPreviews: RecipeRevisionPreview[]
  selectedRevision: RecipeRevisionPreview | null
  condensedLeftPage: React.ReactNode
  rightPage: React.ReactNode
  onEdit: () => void
  onTogglePublish: () => void
  showAllRevisions: boolean
  onToggleRevisions: () => void
  onSelectRevision: (revisionId: string) => void
  isPublished: boolean
  isPublishPending: boolean
}) {
  return (
    <BookSpread
      left={
        showAllRevisions ? (
          <RecipeRevisionArchive
            currentVersion={currentVersion}
            isPublished={isPublished}
            revisions={revisionPreviews}
            selectedRevisionId={selectedRevision?.id ?? null}
            onSelectRevision={onSelectRevision}
          />
        ) : (
          condensedLeftPage
        )
      }
      right={
        showAllRevisions
          ? (selectedRevision?.rightPage ?? (
              <RecipeRevisionPlaceholder
                selectedRevision={selectedRevision}
                revisionCount={revisionPreviews.length}
              />
            ))
          : rightPage
      }
      rightOverlay={
        <RecipeViewBookmarks
          isPublished={isPublished}
          onEdit={onEdit}
          onViewRevisions={onToggleRevisions}
          onTogglePublish={onTogglePublish}
          isPublishPending={isPublishPending}
          isViewingRevisions={showAllRevisions}
        />
      }
    />
  )
}

export default function RecipeSpreadClient({
  slug,
  initialPublished,
  currentVersion,
  revisionPreviews,
  condensedLeftPage,
  rightPage,
}: Props) {
  const router = useRouter()
  const [showAllRevisions, setShowAllRevisions] = useState(false)
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(revisionPreviews[0]?.id ?? null)
  const [isEditing, setIsEditing] = useState(false)
  const [isPublished, setIsPublished] = useState(initialPublished)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedRevision = revisionPreviews.find((revision) => revision.id === selectedRevisionId) ?? revisionPreviews[0] ?? null

  function togglePublish() {
    startTransition(async () => {
      const nextPublished = !isPublished
      const res = await fetch(`/api/recipes/${slug}`, {
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
      const res = await fetch(`/api/recipes/${slug}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <RecipeSpreadEditor
        slug={slug}
        onCancel={() => setIsEditing(false)}
        onSaved={() => setIsEditing(false)}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <RecipeViewingSpread
      currentVersion={currentVersion}
      revisionPreviews={revisionPreviews}
      selectedRevision={selectedRevision}
      condensedLeftPage={condensedLeftPage}
      rightPage={rightPage}
      onEdit={() => setIsEditing(true)}
      onTogglePublish={togglePublish}
      showAllRevisions={showAllRevisions}
      onToggleRevisions={() => setShowAllRevisions((value) => !value)}
      onSelectRevision={setSelectedRevisionId}
      isPublished={isPublished}
      isPublishPending={isPending}
    />
  )
}
