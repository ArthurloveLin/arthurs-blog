'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compress'
import { TemplateConfig } from '@/lib/templates'

interface UploadZoneProps {
  sessionToken: string
  templateConfig?: TemplateConfig
}

type FileProgress = 'pending' | 'compressing' | 'uploading' | 'done' | 'error'

interface UploadStatus {
  name: string
  progress: FileProgress
  error?: string
}

const CATEGORIES = ['上衣', '裤子', '鞋子', '配饰', '其他']

export default function UploadZone({ sessionToken, templateConfig }: UploadZoneProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState<UploadStatus[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')

  const itemLabel = templateConfig?.itemLabel || '项目'
  const isWardrobe = templateConfig?.name === '衣评'

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
          if (selectedCategory) {
            fd.append('category', selectedCategory)
          }

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

  const getEmoji = () => {
    if (templateConfig?.name === '衣评') return '👗'
    if (templateConfig?.name === '美食') return '🍕'
    if (templateConfig?.name === '打卡') return '🏔️'
    return '📸'
  }

  return (
    <div className="w-full">
      {isWardrobe && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/50 shrink-0">上传分类：</span>
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === ''
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              不限
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/70 px-1">
            上传完成后会在后台自动识别价格和商品信息，不阻塞创建。
          </p>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="text-4xl mb-3 opacity-80 animate-bounce-subtle">{getEmoji()}</div>
        <p className="text-sm text-foreground/80 font-bold tracking-tight">
          {selectedCategory ? `上传到「${selectedCategory}」` : `点击选择${itemLabel}图片，或拖拽到这里`}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2 font-bold opacity-50">JPG / PNG / WebP · MAX 5MB</p>
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
        <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Overall progress bar */}
          {uploading && (
            <div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground/60 mb-1">
                <span>上传进度</span>
                <span>{doneCount} / {totalCount}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Per-file status */}
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-card/30 rounded-lg px-2 py-1 border border-border/50">
              <span className="flex-1 truncate text-muted-foreground text-[10px]">{u.name}</span>
              {u.progress === 'pending' && <span className="text-muted-foreground/40 text-[10px] font-medium uppercase">等待中</span>}
              {u.progress === 'compressing' && (
                <span className="text-blue-500 text-[10px] font-bold uppercase animate-pulse">压缩中…</span>
              )}
              {u.progress === 'uploading' && (
                <span className="text-primary text-[10px] font-bold uppercase animate-pulse">上传中…</span>
              )}
              {u.progress === 'done' && <span className="text-green-500 text-[10px] font-bold uppercase">✓ 已创建，后台识别中</span>}
              {u.progress === 'error' && (
                <span className="text-destructive text-[10px] font-bold uppercase">{u.error ?? '失败'}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
