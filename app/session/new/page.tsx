'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TEMPLATES, DEFAULT_TEMPLATE } from '@/lib/templates'

export default function NewSession() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [budget, setBudget] = useState('')
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 自定义模板状态
  const [customConfig, setCustomConfig] = useState(() => {
    const palette = ['#f472b6', '#60a5fa', '#34d399', '#f59e0b', '#8b5cf6', '#06b6d4']
    return {
      ...TEMPLATES.custom,
      dimensions: TEMPLATES.custom.dimensions.map((d, i) => ({
        ...d,
        color: palette[i] || d.color
      }))
    }
  })

  const updateCustomDim = (index: number, field: 'label' | 'color', value: string) => {
    const newDims = [...customConfig.dimensions]
    newDims[index] = { ...newDims[index], [field]: value }
    setCustomConfig({ ...customConfig, dimensions: newDims })
  }

  const addCustomDim = () => {
    if (customConfig.dimensions.length >= 6) return
    const newId = `custom_${Date.now()}`
    const palette = ['#f472b6', '#60a5fa', '#34d399', '#f59e0b', '#8b5cf6', '#06b6d4']
    const nextColor = palette[customConfig.dimensions.length] || '#64748b'
    
    setCustomConfig({
      ...customConfig,
      dimensions: [
        ...customConfig.dimensions,
        { key: newId, label: `新维度 ${customConfig.dimensions.length + 1}`, color: nextColor }
      ]
    })
  }

  const removeCustomDim = (index: number) => {
    if (customConfig.dimensions.length <= 3) return
    const newDims = customConfig.dimensions.filter((_, i) => i !== index)
    setCustomConfig({ ...customConfig, dimensions: newDims })
  }

  const getEmoji = (id: string) => {
    switch(id) {
      case 'wardrobe': return '👗'
      case 'food': return '🍕'
      case 'attraction': return '🏔️'
      case 'custom': return '📦'
      default: return '✨'
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          note: note.trim() || null,
          budget: budget ? parseInt(budget) : null,
          template_id: templateId,
          template_config: templateId === 'custom' ? customConfig : null,
        }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json() as { error?: string }
        throw new Error(msg ?? '创建失败')
      }

      const session = await res.json() as { token: string }
      router.push(`/session/${session.token}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/wardrobe" className="text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-foreground tracking-tight">新建评价会话</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-border space-y-6">
          {/* 模板选择 */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              选择评价模板
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(TEMPLATES).map(([id, config]) => {
                const isActive = templateId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplateId(id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    <span className="text-2xl">{getEmoji(id)}</span>
                    <span className="text-sm font-medium">{config.name}</span>
                    <div className="flex gap-1 mt-1">
                      {config.dimensions.slice(0, 3).map((d) => (
                        <div
                          key={d.key}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: d.color }}
                          title={d.label}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 自定义模板配置 */}
          {templateId === 'custom' && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">
                自定义模板参数
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">评价对象称呼</label>
                  <input
                    type="text"
                    value={customConfig.itemLabel}
                    onChange={(e) => setCustomConfig({ ...customConfig, itemLabel: e.target.value })}
                    placeholder="如：美食、电影"
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">决策标签 (优/劣)</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={customConfig.descLabels?.buy}
                      onChange={(e) => {
                        const newLabels = { ...customConfig.descLabels!, buy: e.target.value };
                        setCustomConfig({ ...customConfig, descLabels: newLabels });
                      }}
                      placeholder="优选"
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-center"
                    />
                    <input
                      type="text"
                      value={customConfig.descLabels?.skip}
                      onChange={(e) => {
                        const newLabels = { ...customConfig.descLabels!, skip: e.target.value };
                        setCustomConfig({ ...customConfig, descLabels: newLabels });
                      }}
                      placeholder="排除"
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-center"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase">雷达图维度 (3-6个)</label>
                  {customConfig.dimensions.length < 6 && (
                    <button
                      type="button"
                      onClick={addCustomDim}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      + 添加维度
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {customConfig.dimensions.map((dim, idx) => (
                    <div key={dim.key} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: dim.color }}
                      />
                      <input
                        type="text"
                        value={dim.label}
                        onChange={(e) => updateCustomDim(idx, 'label', e.target.value)}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-1 text-sm"
                      />
                      {customConfig.dimensions.length > 3 && (
                        <button
                          type="button"
                          onClick={() => removeCustomDim(idx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                会话标题
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={TEMPLATES[templateId]?.titlePlaceholder || '会话名称'}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                备注
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={TEMPLATES[templateId]?.notePlaceholder || '可选，记录一些背景信息'}
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                预算 / 预期支出（元）
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="可选"
                min={0}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? '正在开启视角…' : `开启 ${TEMPLATES[templateId]?.name || 'Life Lens'} 评价会话`}
          </button>
        </form>
      </div>
    </main>
  )
}
