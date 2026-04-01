'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compress'

interface UploadZoneProps {
  sessionToken: string
}

interface UploadStatus {
  name: string
  progress: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export default function UploadZone({ sessionToken }: UploadZoneProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState<UploadStatus[]>([])
  const [uploading, setUploading] = useState(false)

  function updateStatus(index: number, update: Partial<UploadStatus>) {
    setUploads((prev) =>
      prev.map((u, i) => (i === index ? { ...u, ...update } : u))
    )
  }

  async function handleFiles(files: FileList) {
    const accepted = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    )
    if (accepted.length === 0) return

    const statuses: UploadStatus[] = accepted.map((f) => ({
      name: f.name,
      progress: 'pending',
    }))
    setUploads(statuses)
    setUploading(true)

    await Promise.all(
      accepted.map(async (file, i) => {
        updateStatus(i, { progress: 'uploading' })
        try {
          const compressed = await compressImage(file)
          const fd = new FormData()
          fd.append('file', compressed, `${file.name}.webp`)
          fd.append('sessionToken', sessionToken)

          const res = await fetch('/api/items', { method: 'POST', body: fd })
          if (!res.ok) {
            const { error } = await res.json()
            throw new Error(error ?? 'Upload failed')
          }
          updateStatus(i, { progress: 'done' })
        } catch (err) {
          updateStatus(i, {
            progress: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          })
        }
      })
    )

    setUploading(false)
    router.refresh()

    setTimeout(() => setUploads([]), 2000)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-pink-400 bg-pink-50'
            : 'border-gray-300 hover:border-pink-300 hover:bg-gray-50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="text-3xl mb-2">👗</div>
        <p className="text-sm text-gray-500">
          点击选择图片，或拖拽到这里
        </p>
        <p className="text-xs text-gray-400 mt-1">JPG / PNG / WebP，每张最大 5MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={onChange}
        />
      </div>

      {uploads.length > 0 && (
        <div className="mt-3 space-y-1">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-gray-600">{u.name}</span>
              {u.progress === 'pending' && <span className="text-gray-400">等待中</span>}
              {u.progress === 'uploading' && (
                <span className="text-blue-500 animate-pulse">上传中…</span>
              )}
              {u.progress === 'done' && <span className="text-green-500">✓</span>}
              {u.progress === 'error' && (
                <span className="text-red-500 text-xs">{u.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          正在压缩并上传，请稍候…
        </p>
      )}
    </div>
  )
}
