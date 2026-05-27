'use client'

import Link from 'next/link'
import { Bodoni_Moda, IBM_Plex_Mono } from 'next/font/google'
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import useSWR from 'swr'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Camera,
  CheckCheck,
  ChefHat,
  Flame,
  Loader2,
  NotebookPen,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  TimerReset,
} from 'lucide-react'

import styles from './CalorieWorkspace.module.css'

const displayFont = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-calorie-display',
  display: 'swap',
  weight: ['400', '500', '700'],
})

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-calorie-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

type JsonRecord = Record<string, unknown>

interface AgentThreadSummary {
  id: string
  title: string | null
  status: string
  updated_at: string
}

interface AgentMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  text_content: string | null
  structured_content: JsonRecord
  source_kind: string
  created_at: string
}

interface AgentAttachment {
  id: string
  message_id: string | null
  media_type: string
  metadata: JsonRecord
  public_url: string | null
  created_at: string
}

interface AgentRun {
  id: string
  status: string
  created_at: string
  parsed_output: JsonRecord
  error_message: string | null
}

interface AgentThreadBundle {
  thread: AgentThreadSummary
  messages: AgentMessage[]
  attachments: AgentAttachment[]
  runs: AgentRun[]
}

interface NutritionTotals {
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
}

interface DayMealItem extends Partial<NutritionTotals> {
  id?: string
  food_name: string
  quantity_text?: string | null
  grams?: number | null
  estimate_level?: string
  confidence_score?: number | null
  needs_review?: boolean
}

interface DayMeal {
  id: string
  meal_type: string
  meal_label: string | null
  occurred_at: string | null
  totals: NutritionTotals
  items: DayMealItem[]
}

interface DayResponse {
  date: string
  dayLog: {
    id: string
    target_calories: number
    target_protein_g: number
    target_gap_min: number
    target_gap_max: number
  } | null
  totals: NutritionTotals
  meals: DayMeal[]
  summary: {
    mealCount: number
    entryCount: number
    reviewedEntryCount: number
  }
}

interface DraftItem extends Partial<NutritionTotals> {
  food_name: string
  food_alias?: string | null
  quantity_text?: string | null
  grams?: number | null
  estimate_level: 'confirmed' | 'database' | 'estimated'
  source_kind: 'agent' | 'knowledge_db' | 'reference_override' | 'ocr' | 'manual'
  confidence_score?: number | null
  needs_review?: boolean
}

interface DraftMeal {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'custom'
  meal_label?: string | null
  occurred_at?: string | null
  items: DraftItem[]
}

interface DraftPayload {
  schemaVersion: 'calorie-draft-v1'
  date: string | null
  summary: string
  insights: string[]
  totals: Partial<NutritionTotals>
  meals: DraftMeal[]
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return '未记录时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(digits)
}

function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return new Intl.NumberFormat('zh-CN', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value)
}

function formatMealTitle(meal: { meal_type: string; meal_label?: string | null }) {
  const base = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    snack: '加餐',
    custom: '自定义',
  }[meal.meal_type] ?? meal.meal_type

  return meal.meal_label?.trim() ? `${base} · ${meal.meal_label.trim()}` : base
}

function normalizeNutritionTotals(input?: Partial<NutritionTotals> | null): NutritionTotals {
  return {
    calories: typeof input?.calories === 'number' ? input.calories : 0,
    protein_g: typeof input?.protein_g === 'number' ? input.protein_g : 0,
    fat_g: typeof input?.fat_g === 'number' ? input.fat_g : 0,
    carbs_g: typeof input?.carbs_g === 'number' ? input.carbs_g : 0,
    fiber_g: typeof input?.fiber_g === 'number' ? input.fiber_g : 0,
    sugar_g: typeof input?.sugar_g === 'number' ? input.sugar_g : 0,
    sodium_mg: typeof input?.sodium_mg === 'number' ? input.sodium_mg : 0,
  }
}

function getDraftPayload(run: AgentRun | undefined, localCommittedRunIds: string[]) {
  if (!run || run.status !== 'needs_confirmation' || localCommittedRunIds.includes(run.id)) {
    return null
  }

  const rawDraft = run.parsed_output.draftPayload
  if (!rawDraft || typeof rawDraft !== 'object' || Array.isArray(rawDraft)) {
    return null
  }

  return rawDraft as DraftPayload
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function summarizeMessage(message: AgentMessage) {
  if (message.text_content?.trim()) {
    return message.text_content.trim()
  }

  if (Array.isArray(message.structured_content.attachmentIds)) {
    return `附件 ${message.structured_content.attachmentIds.length} 个`
  }

  return '无文本内容'
}

export default function CalorieWorkspace() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [queuedFiles, setQueuedFiles] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [localCommittedRunIds, setLocalCommittedRunIds] = useState<string[]>([])
  const queuedPreviews = useMemo(
    () => queuedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [queuedFiles],
  )

  useEffect(() => {
    return () => {
      for (const preview of queuedPreviews) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [queuedPreviews])

  const {
    data: workspaces,
    error: workspaceError,
    isLoading: isLoadingWorkspaces,
    mutate: mutateWorkspaces,
  } = useSWR<AgentThreadSummary[]>('/api/calorie/workspaces', fetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  })

  const ensureWorkspace = useEffectEvent(async () => {
    if (isLoadingWorkspaces || workspaces === undefined || (workspaces && workspaces.length > 0)) {
      return
    }

    const created = await postJson<AgentThreadSummary>('/api/calorie/workspaces', {
      title: 'Calorie Atelier',
      metadata: {
        visualDirection: 'editorial-lab-v1',
      },
    })

    startTransition(() => {
      setSelectedWorkspaceId(created.id)
    })
    await mutateWorkspaces((current) => current ? [created, ...current] : [created], { revalidate: false })
  })

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !selectedWorkspaceId) {
      startTransition(() => {
        setSelectedWorkspaceId(workspaces[0].id)
      })
      return
    }

    if (workspaces && workspaces.length === 0) {
      void ensureWorkspace()
    }
  }, [selectedWorkspaceId, workspaces])

  const {
    data: threadBundle,
    error: threadError,
    mutate: mutateThread,
    isLoading: isLoadingThread,
  } = useSWR<AgentThreadBundle>(
    selectedWorkspaceId ? `/api/agents/threads/${selectedWorkspaceId}` : null,
    fetcher,
    {
      dedupingInterval: 5_000,
      revalidateOnFocus: false,
    },
  )

  const {
    data: dayData,
    error: dayError,
    mutate: mutateDay,
    isLoading: isLoadingDay,
  } = useSWR<DayResponse>(`/api/calorie/days/${today}`, fetcher, {
    dedupingInterval: 15_000,
    revalidateOnFocus: false,
  })

  const latestPendingRun = useMemo(
    () => threadBundle?.runs.find((run) => run.status === 'needs_confirmation' && !localCommittedRunIds.includes(run.id)),
    [localCommittedRunIds, threadBundle?.runs],
  )

  const latestDraft = getDraftPayload(latestPendingRun, localCommittedRunIds)
  const totals = normalizeNutritionTotals(dayData?.totals)
  const calorieTarget = dayData?.dayLog?.target_calories ?? 1900
  const proteinTarget = dayData?.dayLog?.target_protein_g ?? 130
  const calorieProgress = Math.min(totals.calories / calorieTarget, 1.2)
  const proteinProgress = Math.min(totals.protein_g / proteinTarget, 1.2)
  const gap = calorieTarget - totals.calories
  const reviewedRatio = dayData?.summary.entryCount
    ? dayData.summary.reviewedEntryCount / dayData.summary.entryCount
    : 0

  const attachmentsByMessageId = useMemo(() => {
    const map = new Map<string, AgentAttachment[]>()

    for (const attachment of threadBundle?.attachments ?? []) {
      if (!attachment.message_id) {
        continue
      }

      const current = map.get(attachment.message_id) ?? []
      current.push(attachment)
      map.set(attachment.message_id, current)
    }

    return map
  }, [threadBundle?.attachments])

  async function uploadQueuedFiles(workspaceId: string) {
    if (queuedFiles.length === 0) {
      return [] as string[]
    }

    const createdAttachments = await Promise.all(
      queuedFiles.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('metadata', JSON.stringify({
          filename: file.name,
          clientKind: 'calorie-uploader',
        }))

        const response = await fetch(`/api/agents/threads/${workspaceId}/attachments`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(payload.error ?? `Attachment upload failed: ${response.status}`)
        }

        return response.json() as Promise<AgentAttachment>
      }),
    )

    return createdAttachments.map((attachment) => attachment.id)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedWorkspaceId || isSending) {
      return
    }

    const hasText = draftMessage.trim().length > 0
    const hasFiles = queuedFiles.length > 0
    if (!hasText && !hasFiles) {
      return
    }

    setIsSending(true)
    setComposerError(null)

    try {
      const attachmentIds = await uploadQueuedFiles(selectedWorkspaceId)

      await postJson(`/api/calorie/workspaces/${selectedWorkspaceId}/messages`, {
        textContent: hasText ? draftMessage.trim() : null,
        attachmentIds,
        requestPayload: {
          source: 'calorie-dashboard',
          draftDate: today,
        },
      })

      setDraftMessage('')
      setQueuedFiles([])

      await Promise.all([
        mutateThread(),
        mutateWorkspaces(),
      ])
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : '发送失败，请稍后重试')
    } finally {
      setIsSending(false)
    }
  }

  async function handleCommitDraft() {
    if (!latestPendingRun || isCommitting) {
      return
    }

    setIsCommitting(true)
    setComposerError(null)

    try {
      const nextDay = await postJson<DayResponse>(`/api/calorie/runs/${latestPendingRun.id}/commit`, {
        date: latestDraft?.date ?? today,
      })

      startTransition(() => {
        setLocalCommittedRunIds((current) => [...current, latestPendingRun.id])
      })

      await mutateDay(nextDay, { revalidate: false })
      await mutateThread((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          runs: current.runs.map((run) => run.id === latestPendingRun.id ? { ...run, status: 'succeeded' } : run),
        }
      }, { revalidate: false })
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : '确认失败，请稍后重试')
    } finally {
      setIsCommitting(false)
    }
  }

  const hasLoadingState = (isLoadingWorkspaces && !workspaces) || (selectedWorkspaceId && isLoadingThread && !threadBundle)

  return (
    <div className={`${styles.root} ${displayFont.variable} ${monoFont.variable}`}>
      <div className={styles.atmosphere} aria-hidden="true" />

      <section className={`${styles.shell} ${styles.hero}`}>
        <div className={styles.heroStamp}>PRIVATE LAB / ADMIN ONLY</div>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Nutrition atelier</p>
            <h1 className={styles.title}>
              Calorie Atelier
            </h1>
            <p className={styles.subtitle}>
              把聊天、包装识别和每日账本折叠成一张能直接操作的营养工作台。这里不是“AI 聊天窗”，而是一册带审稿流程的热量台账。
            </p>

            <div className={styles.heroChips}>
              <span>今日账本</span>
              <span>图片送检</span>
              <span>草稿确认</span>
              <span>报表入口</span>
            </div>
          </div>

          <aside className={styles.heroMeter}>
            <div className={styles.meterHeader}>
              <span>Daily burn window</span>
              <span>{today}</span>
            </div>

            <div className={styles.meterDial}>
              <div className={styles.meterTrack}>
                <div className={styles.meterFill} style={{ width: `${Math.min(calorieProgress * 100, 100)}%` }} />
              </div>
              <div className={styles.meterNumbers}>
                <strong>{formatCompact(totals.calories)}</strong>
                <span>/ {formatCompact(calorieTarget)} kcal</span>
              </div>
              <p className={styles.meterHint}>
                {gap >= 0 ? `还剩 ${formatCompact(gap)} kcal 可用` : `已超出 ${formatCompact(Math.abs(gap))} kcal`}
              </p>
            </div>

            <div className={styles.meterStats}>
              <div>
                <span>Protein</span>
                <strong>{formatNumber(totals.protein_g)} g</strong>
              </div>
              <div>
                <span>Reviewed</span>
                <strong>{Math.round(reviewedRatio * 100)}%</strong>
              </div>
              <div>
                <span>Meals</span>
                <strong>{dayData?.summary.mealCount ?? 0}</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={`${styles.shell} ${styles.grid}`}>
        <div className={styles.primaryColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Workspace</p>
                <h2>录入台</h2>
              </div>

              <div className={styles.workspaceMeta}>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => {
                    void Promise.all([mutateWorkspaces(), mutateThread(), mutateDay()])
                  }}
                  aria-label="刷新工作台"
                >
                  <RefreshCw size={16} />
                </button>
                <span>{threadBundle?.thread.title ?? 'Calorie Atelier'}</span>
                <span>{threadBundle ? formatTime(threadBundle.thread.updated_at) : '等待初始化'}</span>
              </div>
            </div>

            {workspaceError || threadError ? (
              <div className={styles.errorBanner}>
                {(workspaceError ?? threadError)?.message ?? '工作台加载失败'}
              </div>
            ) : null}

            {hasLoadingState ? (
              <div className={styles.streamSkeleton}>
                <div />
                <div />
                <div />
              </div>
            ) : (
              <>
                <div className={styles.messageStream}>
                  {threadBundle?.messages.length ? threadBundle.messages.map((message) => {
                    const attachments = attachmentsByMessageId.get(message.id) ?? []
                    const isAssistant = message.role === 'assistant'

                    return (
                      <article
                        key={message.id}
                        className={`${styles.messageCard} ${isAssistant ? styles.messageCardAssistant : styles.messageCardUser}`}
                      >
                        <div className={styles.messageTopline}>
                          <span>{isAssistant ? 'Atelier' : 'You'}</span>
                          <time>{formatTime(message.created_at)}</time>
                        </div>
                        <p className={styles.messageText}>{summarizeMessage(message)}</p>
                        {attachments.length > 0 ? (
                          <div className={styles.attachmentRow}>
                            {attachments.map((attachment) => (
                              <span key={attachment.id} className={styles.attachmentPill}>
                                <Camera size={13} />
                                {typeof attachment.metadata.filename === 'string' ? attachment.metadata.filename : attachment.media_type}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    )
                  }) : (
                    <div className={styles.emptyState}>
                      <NotebookPen size={18} />
                      <div>
                        <strong>今天还没开始记账</strong>
                        <p>直接输入一餐内容，或者拖入包装照片。系统会先给草稿，再由你确认入账。</p>
                      </div>
                    </div>
                  )}
                </div>

                <form className={styles.composer} onSubmit={handleSubmit}>
                  <div className={styles.composerHeader}>
                    <div>
                      <p className={styles.kicker}>Compose</p>
                      <h3>发一段文本，或丢一张图</h3>
                    </div>
                    <label className={styles.uploadButton}>
                      <Camera size={15} />
                      添加图片
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className={styles.hiddenInput}
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? [])
                          if (files.length === 0) {
                            return
                          }

                          setQueuedFiles((current) => [...current, ...files])
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                  </div>

                  <div className={styles.quickPrompts}>
                    {[
                      '早餐：双吉蛋麦满分 + 美式',
                      '午餐：鸡胸肉沙拉 + 玉米杯',
                      '请识别这张包装图里的营养成分',
                      '总结今天',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={styles.quickPrompt}
                        onClick={() => setDraftMessage(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    className={styles.composerInput}
                    rows={5}
                    placeholder="例如：晚餐吃了去酱板烧鸡腿堡、玉米杯和零度可乐；或者‘请识别这张图里的营养标签’。"
                  />

                  {queuedPreviews.length > 0 ? (
                    <div className={styles.previewStrip}>
                      {queuedPreviews.map(({ file, url }) => (
                        <figure key={`${file.name}-${file.lastModified}`} className={styles.previewCard}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={file.name} className={styles.previewImage} />
                          <figcaption>
                            <strong>{file.name}</strong>
                            <span>{formatCompact(file.size / 1024)} KB</span>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}

                  {composerError ? <div className={styles.errorBanner}>{composerError}</div> : null}

                  <div className={styles.composerFooter}>
                    <div className={styles.footerNote}>
                      <Sparkles size={14} />
                      所有输出先进入草稿，不直接记账。
                    </div>

                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={isSending || (!draftMessage.trim() && queuedFiles.length === 0) || !selectedWorkspaceId}
                    >
                      {isSending ? <Loader2 className={styles.spinner} size={16} /> : <SendHorizontal size={16} />}
                      {isSending ? '分析中…' : '送入 Atelier'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>

        <aside className={styles.secondaryColumn}>
          <section className={`${styles.panel} ${styles.statsPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Today ledger</p>
                <h2>今日进度</h2>
              </div>
              <Link href={`/calorie/day/${today}`} className={styles.linkButton}>
                细看日账 <ArrowUpRight size={15} />
              </Link>
            </div>

            <div className={styles.statsGrid}>
              <article className={styles.statCard}>
                <div className={styles.statLabel}><Flame size={14} /> 热量</div>
                <strong>{formatNumber(totals.calories)}</strong>
                <span>目标 {formatNumber(calorieTarget)} kcal</span>
              </article>
              <article className={styles.statCard}>
                <div className={styles.statLabel}><ChefHat size={14} /> 蛋白</div>
                <strong>{formatNumber(totals.protein_g, 1)}</strong>
                <span>目标 {formatNumber(proteinTarget)} g</span>
              </article>
              <article className={styles.statCard}>
                <div className={styles.statLabel}><Activity size={14} /> 碳水</div>
                <strong>{formatNumber(totals.carbs_g, 1)}</strong>
                <span>脂肪 {formatNumber(totals.fat_g, 1)} g</span>
              </article>
              <article className={styles.statCard}>
                <div className={styles.statLabel}><CheckCheck size={14} /> 复核率</div>
                <strong>{Math.round(reviewedRatio * 100)}%</strong>
                <span>{dayData?.summary.reviewedEntryCount ?? 0} / {dayData?.summary.entryCount ?? 0}</span>
              </article>
            </div>

            <div className={styles.progressBlock}>
              <div>
                <span>Calorie progress</span>
                <strong>{Math.round(calorieProgress * 100)}%</strong>
              </div>
              <div className={styles.progressRail}>
                <div style={{ width: `${Math.min(calorieProgress * 100, 100)}%` }} />
              </div>
            </div>

            <div className={styles.progressBlock}>
              <div>
                <span>Protein progress</span>
                <strong>{Math.round(proteinProgress * 100)}%</strong>
              </div>
              <div className={styles.progressRail}>
                <div style={{ width: `${Math.min(proteinProgress * 100, 100)}%` }} />
              </div>
            </div>

            <div className={styles.daybook}>
              <div className={styles.daybookHeader}>
                <span>Meals log</span>
                <span>{dayData?.summary.mealCount ?? 0} 餐</span>
              </div>

              {isLoadingDay && !dayData ? (
                <div className={styles.inlineLoading}>读取今日账本…</div>
              ) : dayError ? (
                <div className={styles.errorBanner}>{dayError.message}</div>
              ) : dayData?.meals.length ? (
                <div className={styles.mealList}>
                  {dayData.meals.map((meal) => (
                    <article key={meal.id} className={styles.mealCard}>
                      <header>
                        <strong>{formatMealTitle(meal)}</strong>
                        <span>{formatTime(meal.occurred_at)}</span>
                      </header>
                      <p>{meal.items.map((item) => item.food_name).join(' · ')}</p>
                      <footer>
                        <span>{formatNumber(meal.totals.calories)} kcal</span>
                        <span>{formatNumber(meal.totals.protein_g, 1)} g protein</span>
                      </footer>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyStateCompact}>今日还没有正式入账的餐次。</div>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.draftPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Review desk</p>
                <h2>待确认草稿</h2>
              </div>
              {latestPendingRun ? <span className={styles.reviewBadge}>run {latestPendingRun.id.slice(0, 8)}</span> : null}
            </div>

            {latestDraft ? (
              <>
                <div className={styles.draftHeadline}>
                  <strong>{latestDraft.summary}</strong>
                  <span>{latestDraft.date ?? today}</span>
                </div>

                {latestDraft.insights.length > 0 ? (
                  <ul className={styles.insightsList}>
                    {latestDraft.insights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                ) : null}

                <div className={styles.draftMeals}>
                  {latestDraft.meals.map((meal, index) => (
                    <section key={`${meal.meal_type}-${index}`} className={styles.draftMeal}>
                      <header>
                        <strong>{formatMealTitle(meal)}</strong>
                        <span>{meal.occurred_at ? formatTime(meal.occurred_at) : '待确认'}</span>
                      </header>
                      <div className={styles.draftItems}>
                        {meal.items.map((item) => (
                          <div key={`${meal.meal_type}-${item.food_name}-${item.quantity_text ?? 'unit'}`} className={styles.draftItemRow}>
                            <div>
                              <strong>{item.food_name}</strong>
                              <span>{item.quantity_text ?? '1 份'} · {item.estimate_level}</span>
                            </div>
                            <div>
                              <strong>{formatNumber(item.calories)} kcal</strong>
                              <span>{formatNumber(item.protein_g, 1)} g 蛋白</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className={styles.draftTotals}>
                  <div>
                    <span>草稿热量</span>
                    <strong>{formatNumber(latestDraft.totals.calories)} kcal</strong>
                  </div>
                  <div>
                    <span>草稿蛋白</span>
                    <strong>{formatNumber(latestDraft.totals.protein_g, 1)} g</strong>
                  </div>
                </div>

                <div className={styles.draftActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      void mutateThread()
                    }}
                  >
                    <TimerReset size={15} />
                    刷新草稿
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => {
                      void handleCommitDraft()
                    }}
                    disabled={isCommitting}
                  >
                    {isCommitting ? <Loader2 className={styles.spinner} size={16} /> : <CheckCheck size={16} />}
                    {isCommitting ? '写入中…' : '确认入账'}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <Sparkles size={18} />
                <div>
                  <strong>没有待确认草稿</strong>
                  <p>发送一段餐食描述或一张包装图，右侧会出现可审稿的营养条目。</p>
                </div>
              </div>
            )}
          </section>

          <section className={`${styles.panel} ${styles.linksPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Navigation</p>
                <h2>延伸视图</h2>
              </div>
            </div>

            <div className={styles.linkDeck}>
              <Link href={`/calorie/day/${today}`} className={styles.deckLink}>
                <div>
                  <CalendarDays size={17} />
                  <strong>Day Ledger</strong>
                </div>
                <p>看单日餐次、条目和人工修正的完整账页。</p>
              </Link>
              <Link href="/calorie/reports" className={styles.deckLink}>
                <div>
                  <Activity size={17} />
                  <strong>Reports</strong>
                </div>
                <p>切换日报、周报、月报，检查估算占比与趋势。</p>
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}