'use client'

import dynamic from 'next/dynamic'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import BookSpread from './BookSpread'
import RecipeViewBookmarks from './RecipeViewBookmarks'
import RecipeSpreadSkeleton from './RecipeSpreadSkeleton'

interface Props {
  slug: string
  initialPublished: boolean
  condensedLeftPage: React.ReactNode
  fullLeftPage: React.ReactNode
  rightPage: React.ReactNode
}

const RecipeSpreadEditor = dynamic(() => import('./RecipeSpreadEditor'), {
  ssr: false,
  loading: () => <RecipeSpreadSkeleton />,
})

function RecipeViewingSpread({
  condensedLeftPage,
  fullLeftPage,
  rightPage,
  onEdit,
  onTogglePublish,
  showAllRevisions,
  onToggleRevisions,
  isPublished,
  isPublishPending,
}: {
  condensedLeftPage: React.ReactNode
  fullLeftPage: React.ReactNode
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
      left={showAllRevisions ? fullLeftPage : condensedLeftPage}
      right={rightPage}
      rightOverlay={
        <RecipeViewBookmarks
          isPublished={isPublished}
          onEdit={onEdit}
          onViewRevisions={onToggleRevisions}
          onTogglePublish={onTogglePublish}
          isPublishPending={isPublishPending}
        />
      }
    />
  )
}

export default function RecipeSpreadClient({
  slug,
  initialPublished,
  condensedLeftPage,
  fullLeftPage,
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
      condensedLeftPage={condensedLeftPage}
      fullLeftPage={fullLeftPage}
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
