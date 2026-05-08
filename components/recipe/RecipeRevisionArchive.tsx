'use client'

import type { RecipeRevisionPreview } from './revision-preview'

interface Props {
  currentVersion: string
  isPublished: boolean
  revisions: RecipeRevisionPreview[]
  selectedRevisionId: string | null
  onSelectRevision: (revisionId: string) => void
}

export default function RecipeRevisionArchive({
  currentVersion,
  isPublished,
  revisions,
  selectedRevisionId,
  onSelectRevision,
}: Props) {
  const selectedRevision = revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions[0] ?? null

  return (
    <div className="bs-page-scroll-content flex flex-col gap-3 text-xs" style={{ color: 'oklch(0.3 0.02 50)' }}>
      <div className="shrink-0 pb-2 border-b border-amber-800/20">
        <p className="text-[9px] font-mono tracking-[0.18em] uppercase text-amber-900/50">版本档案</p>
        <h2 className="text-sm font-bold mt-1">当前版本 v{currentVersion}</h2>
        <p className="text-[10px] mt-1 leading-relaxed text-amber-900/65">
          版本号只在你想保留一个里程碑时再调整。发布或下线只控制是否公开可见，不会自动生成旧版本。
        </p>
        <div className="flex gap-2 mt-2 text-[10px] text-amber-900/55">
          <span>{isPublished ? '当前已发布' : '当前未发布'}</span>
          <span>已存档 {revisions.length} 个旧版本</span>
        </div>

        {selectedRevision && (
          <div className="mt-3 rounded border border-amber-800/20 bg-white/55 px-3 py-2.5 text-[10px] leading-relaxed text-amber-950/75">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-amber-950/85">正在回顾 v{selectedRevision.version}</p>
                <p className="mt-1">{selectedRevision.changeSummary}</p>
              </div>
              <span className="shrink-0 text-[9px] text-amber-900/45">
                {new Date(selectedRevision.createdAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            {(selectedRevision.snapshotTitle || selectedRevision.snapshotCategory) && (
              <p className="mt-2 text-[9px] text-amber-900/55">
                {selectedRevision.snapshotTitle ?? '未命名快照'}
                {selectedRevision.snapshotCategory ? ` · ${selectedRevision.snapshotCategory}` : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {revisions.length === 0 ? (
        <div className="rounded border border-dashed border-amber-800/25 px-3 py-2 text-[10px] leading-relaxed text-amber-900/60">
          还没有旧版本。下次保存时如果改动版本号，并填写本次变更说明，当前内容就会被归档到这里。
        </div>
      ) : (
        <>
          <div className="shrink-0">
            <p className="text-[9px] font-mono tracking-widest uppercase mb-1 text-amber-900/45">跳转到旧版本</p>
            <ol className="flex gap-2 overflow-x-auto pb-1">
              {revisions.map((revision) => {
                const active = revision.id === selectedRevision?.id

                return (
                  <li key={revision.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRevision(revision.id)}
                      className="min-w-[102px] rounded border px-2.5 py-2 text-left transition-colors"
                      style={{
                        borderColor: active ? 'oklch(0.65 0.18 35 / 0.45)' : 'oklch(0.65 0.08 55 / 0.2)',
                        background: active ? 'oklch(0.95 0.03 80)' : 'transparent',
                      }}
                    >
                      <span className="block font-mono text-[10px] text-amber-900/80">v{revision.version}</span>
                      <span className="mt-1 block text-[9px] text-amber-900/45">
                        {new Date(revision.createdAt).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-amber-950/70">
                        {revision.snapshotTitle ?? revision.changeSummary}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          {selectedRevision && (
            selectedRevision.leftPage ? (
              <div className="min-h-0 flex-1 overflow-hidden rounded border border-amber-800/15 bg-white/45 px-3 py-3">
                <div className="h-full overflow-hidden">{selectedRevision.leftPage}</div>
              </div>
            ) : (
              <div className="rounded border border-dashed border-amber-800/25 px-3 py-3 text-[10px] leading-relaxed text-amber-900/60">
                这个旧版本只有修订说明，还没有完整快照，因此暂时无法还原成可翻阅的书页。
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}