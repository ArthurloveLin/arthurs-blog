'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import { Loader2 } from 'lucide-react'
import 'react-image-crop/dist/ReactCrop.css'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

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
  site_slogan_1?: string
  site_slogan_2?: string
  memo_hero_subtitle?: string
  memo_hero_title_highlight?: string
  memo_hero_title_highlight_2?: string
  memo_hero_title_rest?: string
  memo_hero_description?: string
  memo_slogan_1?: string
  memo_slogan_2?: string
  guestbook_hero_subtitle?: string
  guestbook_hero_title_highlight?: string
  guestbook_hero_title_highlight_2?: string
  guestbook_hero_title_rest?: string
  guestbook_hero_description?: string
  guestbook_slogan_1?: string
  guestbook_slogan_2?: string
  news_hero_subtitle?: string
  news_hero_title_highlight?: string
  news_hero_title_highlight_2?: string
  news_hero_title_rest?: string
  news_hero_description?: string
  news_slogan_1?: string
  news_slogan_2?: string
  live2d_model_url?: string
  live2d_engine_js_url?: string
  live2d_canvas_width?: string
  live2d_canvas_height?: string
}

const LIVE2D_PRESETS = [
  { 
    id: 'tororo', 
    name: 'Tororo (白猫)', 
    url: 'https://cdn.arthurlovegrace.top/tororo/tororo.model.json',
    width: '280',
    height: '240'
  },
  { 
    id: 'hijiki', 
    name: 'Hijiki (黑猫)', 
    url: 'https://cdn.arthurlovegrace.top/hijiki/hijiki.model.json',
    width: '280',
    height: '240'
  },
  { 
    id: 'ots14_normal', 
    name: 'OTS14 (默认)', 
    url: 'https://cdn.arthurlovegrace.top/ots14_3001/normal/model.json',
    width: '340',
    height: '400'
  },
  { 
    id: 'ots14_bridal', 
    name: 'OTS14 (婚纱)', 
    url: 'https://cdn.arthurlovegrace.top/ots14_3001/destroy/model.json',
    width: '340',
    height: '400'
  },
]

const STATUS_OPTIONS = [
  { emoji: '👨‍💻', label: '工作中', value: '工作中' },
  { emoji: '🏖️', label: '休息中', value: '休息中' },
  { emoji: '📚', label: '学习中', value: '学习中' },
  { emoji: '🚀', label: '正在上线', value: '正在上线' },
  { emoji: '🍱', label: '干饭中', value: '干饭中' },
  { emoji: '💡', label: '沉思中', value: '沉思中' },
  { emoji: '💤', label: '挂机中', value: '挂机中' },
]

function HeroSettingsGroup({
  title,
  prefix,
  data,
  onChange,
}: {
  title: string
  prefix: string // 'site' | 'memo_hero' | 'guestbook_hero' | 'news_hero' (except slogan which might just be memo_slogan, site_slogan, etc. Wait, we named them prefix_hero_* and prefix_slogan)
  data: ConfigData
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}) {
  const subtitleKey = prefix === 'site' ? 'site_subtitle' : `${prefix}_hero_subtitle`
  const hlKey1 = prefix === 'site' ? 'site_title_highlight' : `${prefix}_hero_title_highlight`
  const hlKey2 = prefix === 'site' ? 'site_title_highlight_2' : `${prefix}_hero_title_highlight_2`
  const restKey = prefix === 'site' ? 'site_title_rest' : `${prefix}_hero_title_rest`
  const descKey = prefix === 'site' ? 'site_description' : `${prefix}_hero_description`
  const slogan1Key = prefix === 'site' ? 'site_slogan_1' : `${prefix}_slogan_1`
  const slogan2Key = prefix === 'site' ? 'site_slogan_2' : `${prefix}_slogan_2`

  return (
    <div className="bg-card text-card-foreground border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 md:p-8">
      <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-6">{title}</h2>
      
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">副标题 (顶部暗色小字)</label>
          <input
            type="text"
            name={subtitleKey}
            value={(data as Record<string, string>)[subtitleKey] || ''}
            onChange={onChange}
            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-primary mb-1.5 ml-1">主标题_段落1(渐变)</label>
            <input
              type="text"
              name={hlKey1}
              value={(data as Record<string, string>)[hlKey1] || ''}
              onChange={onChange}
              className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-primary mb-1.5 ml-1">主标题_段落2(渐变)</label>
            <input
              type="text"
              name={hlKey2}
              value={(data as Record<string, string>)[hlKey2] || ''}
              onChange={onChange}
              placeholder="（选填）"
              className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">主标题_段落3(普通)</label>
            <input
              type="text"
              name={restKey}
              value={(data as Record<string, string>)[restKey] || ''}
              onChange={onChange}
              className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">介绍/导语 (Description)</label>
          <textarea
            name={descKey}
            value={(data as Record<string, string>)[descKey] || ''}
            onChange={onChange}
            rows={2}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">手写标语 第一行 (Slogan 1)</label>
            <input
              type="text"
              name={slogan1Key}
              value={(data as Record<string, string>)[slogan1Key] || ''}
              onChange={onChange}
              className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">手写标语 第二行 (Slogan 2)</label>
            <input
              type="text"
              name={slogan2Key}
              value={(data as Record<string, string>)[slogan2Key] || ''}
              onChange={onChange}
              placeholder="（选填）"
              className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SiteSettingsForm({ initialData }: { initialData: Record<string, string> }) {
  const router = useRouter()
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

  // Live2D Scan states
  const [scannedModels, setScannedModels] = useState<{ id: string; name: string; url: string }[]>([])
  const [isScanning, setIsScanning] = useState(false)

  const handleScanModels = async () => {
    setIsScanning(true)
    setMessage('🔍 正在扫描 CDN 目录...')
    try {
      const res = await fetch('/api/admin/live2d/scan')
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Scan failed')
      setScannedModels(result.models || [])
      setMessage(`✅ 扫描完成，发现 ${result.models?.length || 0} 个模型。`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(`❌ 扫描失败: ${msg}`)
    } finally {
      setIsScanning(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage('❌ 请选择图片文件')
      e.target.value = ''
      return
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setMessage('❌ 图片大小不能超过 5MB')
      e.target.value = ''
      return
    }

    setMessage('')
    setCrop(undefined)
    setCompletedCrop(undefined)

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setImgSrc(reader.result?.toString() || '')
      setShowCropModal(true)
    })
    reader.readAsDataURL(file)
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

      canvas.width = Math.max(1, Math.round(completedCrop.width * scaleX))
      canvas.height = Math.max(1, Math.round(completedCrop.height * scaleY))

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
      setImgSrc('')
      setCompletedCrop(undefined)
      setCrop(undefined)
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
      router.refresh()
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
              <button
                type="button"
                className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors relative group/avatar disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openFilePicker}
                disabled={uploading}
                aria-label="上传头像"
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
              </button>
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
        <HeroSettingsGroup title="首页头图文案 (Home Hero)" prefix="site" data={data} onChange={handleChange} />

        {/* ── Memo 文案模块 ── */}
        <HeroSettingsGroup title="便签墙头图文案 (Memo Hero)" prefix="memo" data={data} onChange={handleChange} />

        {/* ── 留言板文案模块 ── */}
        <HeroSettingsGroup title="留言板头图文案 (Guestbook Hero)" prefix="guestbook" data={data} onChange={handleChange} />

        {/* ── 趋势雷达文案模块 ── */}
        <HeroSettingsGroup title="趋势雷达头图文案 (Trend Radar Hero)" prefix="news" data={data} onChange={handleChange} />

        {/* ── Live2D 看板娘配置 ── */}
        <div className="bg-card text-card-foreground border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">看板娘配置 (Live2D Settings)</h2>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-tight">CDN Optimized</span>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-foreground ml-1">角色预设 (Presets)</label>
                <button
                  type="button"
                  onClick={handleScanModels}
                  disabled={isScanning}
                  className="text-[10px] font-bold text-primary hover:opacity-80 transition-opacity flex items-center gap-1 bg-primary/5 px-2 py-1 rounded-md"
                >
                  {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔄 自动扫描 CDN 模型'}
                </button>
              </div>

              <div className="space-y-4">
                {/* Manual Presets */}
                <div className="flex flex-wrap gap-2">
                  {LIVE2D_PRESETS.map((preset) => {
                    const isSelected = data.live2d_model_url === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setData(prev => ({ 
                            ...prev, 
                            live2d_model_url: preset.url,
                            live2d_canvas_width: preset.width,
                            live2d_canvas_height: preset.height
                          }));
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                  
                  {/* Manual / Custom Button - Always present */}
                  <button
                    type="button"
                    onClick={() => {
                      // Only clear if it was a preset, otherwise leave it for editing
                      setData(prev => ({ 
                        ...prev, 
                        live2d_model_url: (LIVE2D_PRESETS.some(p => p.url === prev.live2d_model_url) || scannedModels.some(p => p.url === prev.live2d_model_url)) ? '' : prev.live2d_model_url
                      }));
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed transition-all ${
                      (!LIVE2D_PRESETS.some(p => p.url === data.live2d_model_url) && !scannedModels.some(p => p.url === data.live2d_model_url))
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {(!LIVE2D_PRESETS.some(p => p.url === data.live2d_model_url) && !scannedModels.some(p => p.url === data.live2d_model_url)) 
                      ? '✍️ 自定义模式中' 
                      : '➕ 手动输入 / 自定义'}
                  </button>
                </div>

                {/* Scanned Results */}
                {scannedModels.length > 0 && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-500">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">扫描到的模型 (Found on CDN)</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl border border-dashed border-border">
                      {scannedModels.map((model) => {
                        const isSelected = data.live2d_model_url === model.url;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              setData(prev => ({ 
                                ...prev, 
                                live2d_model_url: model.url,
                                // Provide default size if switching to a new unknown model
                                live2d_canvas_width: isSelected ? prev.live2d_canvas_width : (prev.live2d_canvas_width || '280'),
                                live2d_canvas_height: isSelected ? prev.live2d_canvas_height : (prev.live2d_canvas_height || '240')
                              }));
                            }}
                            className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-primary/20 border-primary text-primary shadow-sm font-semibold'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                            }`}
                          >
                            {model.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">模型 JSON URL</label>
                    <input
                      type="text"
                      name="live2d_model_url"
                      value={data.live2d_model_url || ''}
                      onChange={handleChange}
                      placeholder="https://cdn.../model.json"
                      className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all font-mono text-[11px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">窗口宽度 (Canvas Width)</label>
                      <input
                        type="number"
                        name="live2d_canvas_width"
                        value={data.live2d_canvas_width || ''}
                        onChange={handleChange}
                        placeholder="280"
                        className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">窗口高度 (Canvas Height)</label>
                      <input
                        type="number"
                        name="live2d_canvas_height"
                        value={data.live2d_canvas_height || ''}
                        onChange={handleChange}
                        placeholder="240"
                        className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5 ml-1">引擎 JS URL</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    name="live2d_engine_js_url"
                    value={data.live2d_engine_js_url || ''}
                    onChange={handleChange}
                    placeholder="https://cdn.../live2d.js"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all font-mono text-[11px]"
                  />
                  {!data.live2d_engine_js_url && (
                    <button
                      type="button"
                      onClick={() => setData(prev => ({ ...prev, live2d_engine_js_url: 'https://cdn.arthurlovegrace.top/js/live2d.js' }))}
                      className="text-[10px] text-primary hover:underline ml-1"
                    >
                      使用 R2 默认引擎路径
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground ml-1">
              建议将模型文件上传至 Cloudflare R2 以获得最佳加载速度。如果为空，将回退到本地默认文件。
            </p>
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
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
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
                  {/* eslint-disable-next-line @next/next/no-img-element -- react-image-crop 需要原生 img 元素 */}
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imgSrc}
                    onLoad={onImageLoad}
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
