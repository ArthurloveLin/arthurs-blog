'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Item {
  id: string
  image_url: string
  decision: 'buy' | 'skip' | 'pending'
  created_at: string
  avgScore: number | null
  commentCount: number
}

interface ImageGridProps {
  items: Item[]
  sessionToken: string
}

export default function ImageGrid({ items, sessionToken }: ImageGridProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('确定删除这张图片吗？')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-6xl mb-4">📷</div>
        <p className="text-base">还没有图片</p>
        <p className="text-sm mt-1">上传第一张，开始选衣吧～</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative group rounded-xl overflow-hidden bg-gray-100 shadow-sm"
        >
          <a href={`/session/${sessionToken}/item/${item.id}`}>
            <div className="relative aspect-square">
              <Image
                src={item.image_url}
                alt="衣服图片"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />
            </div>

            <div className="p-2">
              {item.avgScore !== null ? (
                <p className="text-xs text-yellow-500 font-medium">
                  {'★'.repeat(Math.round(item.avgScore))}
                  {'☆'.repeat(5 - Math.round(item.avgScore))}
                  <span className="text-gray-400 ml-1">{item.avgScore.toFixed(1)}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-300">暂无评分</p>
              )}
              {item.commentCount > 0 && (
                <p className="text-xs text-gray-400">{item.commentCount} 条评论</p>
              )}
            </div>
          </a>

          {/* Delete button */}
          <button
            onClick={() => handleDelete(item.id)}
            disabled={deleting === item.id}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500 disabled:bg-gray-400"
          >
            {deleting === item.id ? '…' : '×'}
          </button>

          {/* Decision badge */}
          {item.decision !== 'pending' && (
            <div className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${
              item.decision === 'buy'
                ? 'bg-green-500 text-white'
                : 'bg-gray-500 text-white'
            }`}>
              {item.decision === 'buy' ? '买' : '不买'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
