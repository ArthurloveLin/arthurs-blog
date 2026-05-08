'use client'

import dynamic from 'next/dynamic'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RecipeRevision } from '@/lib/recipes'
import BookSpread from './BookSpread'
import RecipeRevisionArchive from './RecipeRevisionArchive'
import RecipeViewBookmarks from './RecipeViewBookmarks'
import RecipeSpreadSkeleton from './RecipeSpreadSkeleton'

interface Props {
  slug: string
  initialPublished: boolean
  currentVersion: string
  revisions: RecipeRevision[]
  condensedLeftPage: React.ReactNode
  rightPage: React.ReactNode
}

const RecipeSpreadEditor = dynamic(() => import('./RecipeSpreadEditor'), {
  ssr: false,
  loading: () => <RecipeSpreadSkeleton />,
})

function RecipeViewingSpread({
  currentVersion,
  revisions,
  condensedLeftPage,
  rightPage,
  onEdit,
  onTogglePublish,
  showAllRevisions,
  onToggleRevisions,
  isPublished,
  isPublishPending,
}: {
  currentVersion: string
  revisions: RecipeRevision[]
  condensedLeftPage: React.ReactNode
  rightPage: React.ReactNode
  onEdit: () => void
  onTogglePublish: () => void
  showAllRevisions: boolean
  onToggleRevisions: () => void
  isPublished: boolean
  isPublishPending: boolean
}) {
  return (
    <BookSpread
      left={showAllRevisions ? <RecipeRevisionArchive currentVersion={currentVersion} isPublished={isPublished} revisions={revisions} /> : condensedLeftPage}
      right={rightPage}
      motionVariant="anchored"
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
  revisions,
  condensedLeftPage,
  rightPage,
}: Props) {
  const router = useRouter()
  const [showAllRevisions, setShowAllRevisions] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPublished, setIsPublished] = useState(initialPublished)
  const [isPending, startTransition] = useTransition()

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

  if (isEditing) {
    return (
      <RecipeSpreadEditor
        slug={slug}
        onCancel={() => setIsEditing(false)}
        onSaved={() => {
          setIsEditing(false)
        }}
      />
    )
  }

  return (
    <RecipeViewingSpread
      currentVersion={currentVersion}
      revisions={revisions}
      condensedLeftPage={condensedLeftPage}
      rightPage={rightPage}
      onEdit={() => setIsEditing(true)}
      onTogglePublish={togglePublish}
      showAllRevisions={showAllRevisions}
      onToggleRevisions={() => setShowAllRevisions((value) => !value)}
      isPublished={isPublished}
      isPublishPending={isPending}
    />
  )
}
