'use client'

import dynamic from 'next/dynamic'

const DraggableImageGrid = dynamic(() => import('./DraggableImageGrid'), {
  ssr: false,
})

export default DraggableImageGrid
