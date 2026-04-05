'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ConfigData {
  author_avatar_url?: string
  author_name?: string
  author_bio?: string
  author_role?: string
  author_company?: string
  author_location?: string
  author_skills?: string
  author_status?: string
  author_github?: string
  author_linkedin?: string
  author_weibo?: string
  author_wechat?: string
  author_email?: string
  site_subtitle?: string
  site_title_highlight?: string
  site_title_highlight_2?: string
  site_title_rest?: string
  site_description?: string
}

const STATUS_OPTIONS = [
  { emoji: '👨‍💻', label: '工作中', value: '工作中' },
  { emoji: '🏖️', label: '休息中', value: '休息中' },
  { emoji: '📚', label: '学习中', value: '学习中' },
  { emoji: '🚀', label: '正在上线', value: '正在上线' },
  { emoji: '🍱', label: '干饭中', value: '干饭中' },
  { emoji: '💡', label: '沉思中', value: '沉思中' },
  { emoji: '💤', label: '挂机中', value: '挂机中' },
]

export default function SiteSettingsForm({ initialData }: { initialData: Record<string, string> }) {
  const [data, setData] = useState<ConfigData>(initialData)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop states
  const [imgSrc, setImgSrc] = useState('')
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [showCropModal, setShowCropModal] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined)
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '')
        setShowCropModal(true)
      })
      reader.readAsDataURL(e.target.files[0])
    }
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    const cropSize = Math.min(width, height) * 0.9
    const x = (width - cropSize) / 2
    const y = (height - cropSize) / 2
    setCrop({
      unit: 'px',
      width: cropSize,
      height: cropSize,
      x,
      y,
    })
  }

  const handleApplyCrop = async () => {
    if (!completedCrop || !imgRef.current) return

    setUploading(true)
    setMessage('')
    setShowCropModal(false)

    try {
      const image = imgRef.current
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No 2d context')

      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      canvas.width = completedCrop.width * scaleX
      canvas.height = completedCrop.height * scaleY

      ctx.imageSmoothingQuality = 'high'

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY
      )

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Canvas is empty'))
        }, 'image/webp', 0.9)
      })

      const file = new File([blob], 'avatar.webp', { type: 'image/webp' })
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload failed')
      
      setData((prev) => ({ ...prev, author_avatar_url: result.url }))
      setMessage('✅ 头像裁剪并上传成功（请点击下方按钮保存配置生效）')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(`❌ ${msg}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Save failed')
      setMessage('✅ 配置已成功保存！前端即时生效。')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(`❌ 保存失败: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── 资料卡模块 ── */}
        <div className="bg-card text-card-foreground border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 md:p-8 relative overflow-hidden group">
          <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-6">身份资料卡 (Profile)</h2>
          
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {/* Avatar Area */}
            <div className="flex flex-col items-center gap-3 w-32 shrink-0">
              <div 
                className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors relative group/avatar"
                onClick={() => fileInputRef.current?.click()}
              >
                {data.author_avatar_url ? (
                  <>
                    <Image src={data.author_avatar_url} alt="Avatar" width={96} height={96} className="object-cover w-full h-full" unoptimized />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                       <span className="text-white text-xs font-semibold drop-shadow-md">替换头像</span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">点击上传</span>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={onSelectFile} accept="image/*" className="hidden" />
              
              {/* Status Picker Overlay Area? No, let's put it as a field below or beside */}
              <div className="w-full">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 ml-1 text-center">当前状态</label>
                <div className="relative">
                  <select
                    name="author_status"
                    value={data.author_status || ''}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all appearance-none text-center"
                  >
                    <option value="">(无状态)</option>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.emoji} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                头像将同步至<br/>全站导航栏 Logo
              </p>
            </div>

            <div className="flex-1 space-y-4 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">展示姓名</label>
                  <input
                    type="text"
                    name="author_name"
                    value={data.author_name || ''}
                    onChange={handleChange}
                    placeholder="Arthur & Grace"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">地理位置</label>
                  <input
                    type="text"
                    name="author_location"
                    value={data.author_location || ''}
                    onChange={handleChange}
                    placeholder="Shanghai, China"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">职业头衔</label>
                  <input
                    type="text"
                    name="author_role"
                    value={data.author_role || ''}
                    onChange={handleChange}
                    placeholder="开发测试工程师"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">所属组织/公司</label>
                  <input
                    type="text"
                    name="author_company"
                    value={data.author_company || ''}
                    onChange={handleChange}
                    placeholder="某知名大厂"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">个人简介 (Bio)</label>
                <textarea
                  name="author_bio"
                  value={data.author_bio || ''}
                  onChange={handleChange}
                  placeholder="记录生活，连接世界"
                  rows={2}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">技术栈 (用逗号分隔)</label>
                <input
                  type="text"
                  name="author_skills"
                  value={data.author_skills || ''}
                  onChange={handleChange}
                  placeholder="Java, Python, Selenium, Next.js, TypeScript"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">GitHub 用户名</label>
                  <input
                    type="text"
                    name="author_github"
                    value={data.author_github || ''}
                    onChange={handleChange}
                    placeholder="username"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">微博 (Weibo) 链接</label>
                  <input
                    type="text"
                    name="author_weibo"
                    value={data.author_weibo || ''}
                    onChange={handleChange}
                    placeholder="https://weibo.com/u/..."
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">微信 (WeChat)</label>
                  <input
                    type="text"
                    name="author_wechat"
                    value={data.author_wechat || ''}
                    onChange={handleChange}
                    placeholder="WeChat ID"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">联系邮箱 (Email)</label>
                  <input
                    type="email"
                    name="author_email"
                    value={data.author_email || ''}
                    onChange={handleChange}
                    placeholder="example@mail.com"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 首页文案模块 ── */}
        <div className="bg-card text-card-foreground border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 md:p-8">
          <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-6">首页头图文案 (Hero Section)</h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">站点副标题 (顶部暗色小字)</label>
              <input
                type="text"
                name="site_subtitle"
                value={data.site_subtitle || ''}
                onChange={handleChange}
                placeholder="Arthur & Grace · Journal"
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-primary mb-1.5 ml-1">主标题_段落1(渐变)</label>
                <input
                  type="text"
                  name="site_title_highlight"
                  value={data.site_title_highlight || ''}
                  onChange={handleChange}
                  placeholder="技术、生活与创意"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary mb-1.5 ml-1">主标题_段落2(渐变)</label>
                <input
                  type="text"
                  name="site_title_highlight_2"
                  value={data.site_title_highlight_2 || ''}
                  onChange={handleChange}
                  placeholder="（选填）"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">主标题_段落3(普通)</label>
                <input
                  type="text"
                  name="site_title_rest"
                  value={data.site_title_rest || ''}
                  onChange={handleChange}
                  placeholder="的记录与分享"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">介绍/导语 (Hero Description)</label>
              <textarea
                name="site_description"
                value={data.site_description || ''}
                onChange={handleChange}
                placeholder="探索编程、设计、选衣搭配等领域的见解与思考。记录成长，分享知识，连接彼此。"
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Submit Area ── */}
        <div className="flex items-center gap-4 pt-4">
          <button
            type="submit"
            disabled={loading || uploading}
            className="bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-semibold rounded-xl px-8 py-3 text-sm shadow-[0_4px_14px_rgba(0,0,0,0.1)] focus-visible:outline-none shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[120px]"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : '保存修改 (Save Settings)'}
          </button>
          {message && (
            <span className={`text-sm tracking-wide ${message.includes('❌') ? 'text-destructive' : 'text-primary animate-pulse'}`}>
              {message}
            </span>
          )}
        </div>
      </form>

      {/* ── Crop Modal ── */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="font-semibold text-foreground">裁剪头像 (1:1等比)</h3>
              <button 
                onClick={() => {
                  setShowCropModal(false)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                 ✕ 
              </button>
            </div>
            
            <div className="p-4 bg-muted/30 flex justify-center items-center overflow-auto max-h-[60vh]">
              {imgSrc && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop
                >
                  <Image
                    alt="Crop me"
                    src={imgSrc}
                    onLoadingComplete={(img) => {
                       // Trigger onImageLoad using the underlying img element
                       if (img) {
                         onImageLoad({ currentTarget: img } as unknown as React.SyntheticEvent<HTMLImageElement>)
                       }
                    }}
                    width={800}
                    height={600}
                    unoptimized
                    className="max-h-[50vh] w-auto object-contain"
                  />
                </ReactCrop>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-3 bg-card">
              <button
                onClick={() => {
                  setShowCropModal(false)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted text-foreground transition-colors"
                disabled={uploading}
              >
                取消
              </button>
              <button
                onClick={handleApplyCrop}
                disabled={uploading || !completedCrop?.width || !completedCrop?.height}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {uploading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : '确认并上传'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
