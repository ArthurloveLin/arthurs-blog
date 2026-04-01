'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compress'

interface UploadZoneProps {
  sessionToken: string
}

type FileProgress = 'pending' | 'compressing' | 'uploading' | 'done' | 'error'

interface UploadStatus {
  name: string
  progress: FileProgress
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
        try {
          updateStatus(i, { progress: 'compressing' })
          const compressed = await compressImage(file)

          updateStatus(i, { progress: 'uploading' })
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
    setTimeout(() => setUploads([]), 2500)
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

  const doneCount = uploads.filter((u) => u.progress === 'done' || u.progress === 'error').length
  const totalCount = uploads.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

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
        <p className="text-sm text-gray-500">点击选择图片，或拖拽到这里</p>
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
        <div className="mt-3 space-y-2">
          {/* Overall progress bar */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>上传进度</span>
                <span>{doneCount} / {totalCount}</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Per-file status */}
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-gray-600 text-xs">{u.name}</span>
              {u.progress === 'pending' && <span className="text-gray-400 text-xs">等待中</span>}
              {u.progress === 'compressing' && (
                <span className="text-blue-400 text-xs animate-pulse">压缩中…</span>
              )}
              {u.progress === 'uploading' && (
                <span className="text-pink-500 text-xs animate-pulse">上传中…</span>
              )}
              {u.progress === 'done' && <span className="text-green-500 text-xs">✓ 完成</span>}
              {u.progress === 'error' && (
                <span className="text-red-500 text-xs">{u.error ?? '失败'}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
