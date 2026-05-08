'use client'

import { useMemo, useState } from 'react'
import type { RecipeRevision } from '@/lib/recipes'

interface Props {
  currentVersion: string
  isPublished: boolean
  revisions: RecipeRevision[]
}

export default function RecipeRevisionArchive({ currentVersion, isPublished, revisions }: Props) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(revisions[0]?.id ?? null)

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions[0] ?? null,
    [revisions, selectedRevisionId]
  )

  const snapshot = selectedRevision?.snapshot

  return (
    <div className="h-full flex flex-col gap-3 text-xs overflow-y-auto" style={{ color: 'oklch(0.3 0.02 50)' }}>
      <div className="pb-2 border-b border-amber-800/20">
        <p className="text-[9px] font-mono tracking-[0.18em] uppercase text-amber-900/50">版本档案</p>
        <h2 className="text-sm font-bold mt-1">当前版本 v{currentVersion}</h2>
        <p className="text-[10px] mt-1 leading-relaxed text-amber-900/65">
          版本号只在你想保留一个里程碑时再调整。发布或下线只控制是否公开可见，不会自动生成旧版本。
        </p>
        <div className="flex gap-2 mt-2 text-[10px] text-amber-900/55">
          <span>{isPublished ? '当前已发布' : '当前未发布'}</span>
          <span>已存档 {revisions.length} 个旧版本</span>
        </div>
      </div>

      {revisions.length === 0 ? (
        <div className="rounded border border-dashed border-amber-800/25 px-3 py-2 text-[10px] leading-relaxed text-amber-900/60">
          还没有旧版本。下次保存时如果改动版本号，并填写本次变更说明，当前内容就会被归档到这里。
        </div>
      ) : (
        <>
          <div>
            <p className="text-[9px] font-mono tracking-widest uppercase mb-1 text-amber-900/45">已归档版本</p>
            <ol className="space-y-1.5">
              {revisions.map((revision) => {
                const active = revision.id === selectedRevision?.id

                return (
                  <li key={revision.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRevisionId(revision.id)}
                      className="w-full rounded border px-2.5 py-2 text-left transition-colors"
                      style={{
                        borderColor: active ? 'oklch(0.65 0.18 35 / 0.45)' : 'oklch(0.65 0.08 55 / 0.2)',
                        background: active ? 'oklch(0.95 0.03 80)' : 'transparent',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-amber-900/80">v{revision.version}</span>
                        <span className="text-[9px] text-amber-900/45">
                          {new Date(revision.created_at).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-amber-950/70">{revision.change_summary}</p>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          {selectedRevision && (
            <div>
              <p className="text-[9px] font-mono tracking-widest uppercase mb-1 text-amber-900/45">版本摘要</p>
              <div className="rounded border border-amber-800/20 px-3 py-2.5 text-[10px] leading-relaxed text-amber-950/70">
                <p className="font-medium text-amber-900/80">v{selectedRevision.version}</p>
                <p className="mt-1">{selectedRevision.change_summary}</p>
                {snapshot ? (
                  <div className="mt-2 space-y-2 text-amber-900/65">
                    {snapshot.title && (
                      <div>
                        <p className="font-medium text-amber-950/80">{snapshot.title}</p>
                        {snapshot.category && <p>{snapshot.category}</p>}
                      </div>
                    )}
                    {snapshot.description && <p>{snapshot.description}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {snapshot.prep_time_minutes != null && <span>备料 {snapshot.prep_time_minutes} 分钟</span>}
                      {snapshot.cook_time_minutes != null && <span>烹饪 {snapshot.cook_time_minutes} 分钟</span>}
                      {snapshot.servings != null && <span>{snapshot.servings} 人份</span>}
                    </div>
                    {snapshot.ingredients.length > 0 && (
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-amber-900/45">食材</p>
                        <ul className="mt-1 space-y-0.5">
                          {snapshot.ingredients.slice(0, 6).map((ingredient) => (
                            <li key={ingredient.id} className="flex gap-1">
                              <span className="text-amber-900/45">·</span>
                              <span>{ingredient.name}</span>
                              {(ingredient.amount || ingredient.unit) && <span>{ingredient.amount}{ingredient.unit}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {snapshot.steps.length > 0 && (
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-amber-900/45">步骤</p>
                        <ol className="mt-1 space-y-1">
                          {snapshot.steps.slice(0, 4).map((step) => (
                            <li key={step.id}>
                              <span className="font-medium">{step.order}. {step.title || '未命名步骤'}</span>
                              {step.description && <span className="text-amber-900/60"> · {step.description}</span>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-amber-900/55">这个旧版本只有修订说明，还没有完整快照。</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}