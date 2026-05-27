'use client'

import Link from 'next/link'
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import useSWR from 'swr'
import {
  Camera,
  CheckCheck,
  Loader2,
  MessageSquarePlus,
  Plus,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
  Utensils,
} from 'lucide-react'

import {
  calorieDisplayFont,
  calorieMonoFont,
  commitRun,
  deleteWorkspace,
  deleteMeal,
  discardRun,
  fetcher,
  formatCompact,
  formatMealTitle,
  formatNumber,
  formatTime,
  normalizeNutritionTotals,
  requestJson,
  type CalorieDraftMeal,
  type CalorieDraftPayload,
  type DayResponse,
} from './client'
import styles from './CalorieWorkspace.module.css'

type JsonRecord = Record<string, unknown>

interface AgentThreadSummary {
  id: string
  title: string | null
  status: string
  created_at: string
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

function formatWorkspaceTitle(ws: AgentThreadSummary) {
  if (ws.title && ws.title !== 'Calorie Atelier' && ws.title !== 'Calorie Workspace') {
    return ws.title
  }
  const d = new Date(ws.created_at)
  if (Number.isNaN(d.getTime())) return '会话'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

function getDraftFromRun(run: AgentRun | undefined): CalorieDraftPayload | null {
  if (!run || run.status !== 'needs_confirmation') return null
  const raw = run.parsed_output.draftPayload
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as CalorieDraftPayload
}

function summarizeMessage(msg: AgentMessage) {
  if (msg.text_content?.trim()) return msg.text_content.trim()
  if (Array.isArray(msg.structured_content.attachmentIds)) {
    return `附件 ${(msg.structured_content.attachmentIds as unknown[]).length} 个`
  }
  return '无文本内容'
}

function computeDraftTotals(meals: CalorieDraftMeal[]) {
  let calories = 0, protein_g = 0, fat_g = 0, carbs_g = 0, fiber_g = 0, sugar_g = 0, sodium_mg = 0
  for (const meal of meals) {
    for (const item of meal.items) {
      calories += item.calories ?? 0
      protein_g += item.protein_g ?? 0
      fat_g += item.fat_g ?? 0
      carbs_g += item.carbs_g ?? 0
      fiber_g += item.fiber_g ?? 0
      sugar_g += item.sugar_g ?? 0
      sodium_mg += item.sodium_mg ?? 0
    }
  }
  return { calories, protein_g, fat_g, carbs_g, fiber_g, sugar_g, sodium_mg }
}

const NUTRITION_COLS = [
  { key: 'calories' as const, label: '热量', unit: 'kcal' },
  { key: 'protein_g' as const, label: '蛋白', unit: 'g' },
  { key: 'fat_g' as const, label: '脂肪', unit: 'g' },
  { key: 'carbs_g' as const, label: '碳水', unit: 'g' },
  { key: 'fiber_g' as const, label: '纤维', unit: 'g' },
  { key: 'sodium_mg' as const, label: '钠', unit: 'mg' },
]

export default function CalorieWorkspace() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [queuedFiles, setQueuedFiles] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [isDeletingWorkspaceId, setIsDeletingWorkspaceId] = useState<string | null>(null)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [editedDraft, setEditedDraft] = useState<CalorieDraftPayload | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  const queuedPreviews = useMemo(
    () => queuedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [queuedFiles],
  )

  useEffect(() => {
    return () => { for (const p of queuedPreviews) URL.revokeObjectURL(p.url) }
  }, [queuedPreviews])

  const {
    data: workspaces,
    isLoading: isLoadingWorkspaces,
    mutate: mutateWorkspaces,
  } = useSWR<AgentThreadSummary[]>('/api/calorie/workspaces', fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  })

  const ensureWorkspace = useEffectEvent(async () => {
    if (isLoadingWorkspaces || workspaces === undefined || (workspaces && workspaces.length > 0)) return
    const created = await requestJson<AgentThreadSummary>('/api/calorie/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Calorie Workspace' }),
    })
    startTransition(() => setActiveWorkspaceId(created.id))
    await mutateWorkspaces((c) => c ? [created, ...c] : [created], { revalidate: false })
  })

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !activeWorkspaceId) {
      startTransition(() => setActiveWorkspaceId(workspaces[0].id))
      return
    }
    if (workspaces && workspaces.length === 0) void ensureWorkspace()
  }, [activeWorkspaceId, workspaces])

  const {
    data: threadBundle,
    error: threadError,
    mutate: mutateThread,
    isLoading: isLoadingThread,
  } = useSWR<AgentThreadBundle>(
    activeWorkspaceId ? `/api/agents/threads/${activeWorkspaceId}` : null,
    fetcher,
    { dedupingInterval: 5_000, revalidateOnFocus: false },
  )

  const {
    data: dayData,
    mutate: mutateDay,
  } = useSWR<DayResponse>(`/api/calorie/days/${today}`, fetcher, {
    dedupingInterval: 15_000,
    revalidateOnFocus: false,
  })

  const totals = normalizeNutritionTotals(dayData?.totals)
  const calorieTarget = dayData?.dayLog?.target_calories ?? 1900
  const proteinTarget = dayData?.dayLog?.target_protein_g ?? 130
  const calorieProgress = Math.min(totals.calories / calorieTarget, 1)
  const proteinProgress = Math.min(totals.protein_g / proteinTarget, 1)

  const latestPendingRun = useMemo(
    () => threadBundle?.runs.find((r) => r.status === 'needs_confirmation'),
    [threadBundle?.runs],
  )

  const serverDraft = getDraftFromRun(latestPendingRun)
  const trackedRunId = useRef<string | null>(null)

  useEffect(() => {
    const nextRunId = latestPendingRun?.id ?? null
    if (nextRunId === trackedRunId.current) return
    trackedRunId.current = nextRunId
    if (nextRunId && serverDraft) {
      setEditedDraft(structuredClone(serverDraft))
    } else {
      setEditedDraft(null)
    }
  }, [latestPendingRun?.id, serverDraft])

  const draftTotals = useMemo(
    () => editedDraft ? computeDraftTotals(editedDraft.meals) : null,
    [editedDraft],
  )

  const attachmentsByMessageId = useMemo(() => {
    const map = new Map<string, AgentAttachment[]>()
    for (const att of threadBundle?.attachments ?? []) {
      if (!att.message_id) continue
      const cur = map.get(att.message_id) ?? []
      cur.push(att)
      map.set(att.message_id, cur)
    }
    return map
  }, [threadBundle?.attachments])

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [threadBundle?.messages.length])

  async function uploadQueuedFiles(workspaceId: string) {
    if (queuedFiles.length === 0) return [] as string[]
    const created = await Promise.all(
      queuedFiles.map(async (file) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('metadata', JSON.stringify({ filename: file.name, clientKind: 'calorie-uploader' }))
        const res = await fetch(`/api/agents/threads/${workspaceId}/attachments`, { method: 'POST', body: fd })
        if (!res.ok) {
          const p = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(p.error ?? `Attachment upload failed: ${res.status}`)
        }
        return res.json() as Promise<AgentAttachment>
      }),
    )
    return created.map((a) => a.id)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeWorkspaceId || isSending) return
    const hasText = draftMessage.trim().length > 0
    const hasFiles = queuedFiles.length > 0
    if (!hasText && !hasFiles) return

    setIsSending(true)
    setComposerError(null)
    try {
      const attachmentIds = await uploadQueuedFiles(activeWorkspaceId)
      await requestJson(`/api/calorie/workspaces/${activeWorkspaceId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: hasText ? draftMessage.trim() : null,
          attachmentIds,
          requestPayload: { source: 'calorie-dashboard', draftDate: today },
        }),
      })
      setDraftMessage('')
      setQueuedFiles([])
      await Promise.all([mutateThread(), mutateWorkspaces()])
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : '发送失败，请稍后重试')
    } finally {
      setIsSending(false)
    }
  }

  async function handleCommitDraft() {
    if (!latestPendingRun || !editedDraft || isCommitting) return
    setIsCommitting(true)
    setComposerError(null)
    try {
      const nextDay = await commitRun(latestPendingRun.id, editedDraft)
      setEditedDraft(null)
      await mutateDay(nextDay, { revalidate: false })
      await mutateThread((cur) => {
        if (!cur) return cur
        return { ...cur, runs: cur.runs.map((r) => r.id === latestPendingRun.id ? { ...r, status: 'succeeded' } : r) }
      }, { revalidate: false })
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : '确认失败，请稍后重试')
    } finally {
      setIsCommitting(false)
    }
  }

  async function handleDiscardDraft() {
    if (!latestPendingRun || isDiscarding) return
    setIsDiscarding(true)
    try {
      await discardRun(latestPendingRun.id)
      setEditedDraft(null)
      await mutateThread((cur) => {
        if (!cur) return cur
        return { ...cur, runs: cur.runs.map((r) => r.id === latestPendingRun.id ? { ...r, status: 'discarded' } : r) }
      }, { revalidate: false })
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : '抛弃失败，请稍后重试')
    } finally {
      setIsDiscarding(false)
    }
  }

  async function handleCreateWorkspace() {
    const created = await requestJson<AgentThreadSummary>('/api/calorie/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Calorie Workspace' }),
    })
    await mutateWorkspaces((c) => c ? [created, ...c] : [created], { revalidate: false })
    startTransition(() => setActiveWorkspaceId(created.id))
  }

  async function handleDeleteWorkspace(id: string) {
    if (isDeletingWorkspaceId) return
    setIsDeletingWorkspaceId(id)
    try {
      await deleteWorkspace(id)
      await mutateWorkspaces((c) => c?.filter((w) => w.id !== id), { revalidate: false })
      if (activeWorkspaceId === id) {
        const remaining = (workspaces ?? []).filter((w) => w.id !== id)
        startTransition(() => setActiveWorkspaceId(remaining[0]?.id ?? null))
      }
    } finally {
      setIsDeletingWorkspaceId(null)
    }
  }

  async function handleDeleteMeal(mealId: string) {
    if (deletingMealId) return
    setDeletingMealId(mealId)
    try {
      await deleteMeal(mealId)
      await mutateDay()
    } finally {
      setDeletingMealId(null)
    }
  }

  function updateDraftItem(
    mealIdx: number,
    itemIdx: number,
    field: string,
    value: string,
  ) {
    setEditedDraft((prev) => {
      if (!prev) return prev
      const meals = prev.meals.map((meal, mi) => {
        if (mi !== mealIdx) return meal
        return {
          ...meal,
          items: meal.items.map((item, ii) => {
            if (ii !== itemIdx) return item
            const numFields = new Set(['calories', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'grams', 'confidence_score'])
            return {
              ...item,
              [field]: numFields.has(field) ? (value === '' ? null : Number(value)) : value,
            }
          }),
        }
      })
      return { ...prev, meals }
    })
  }

  function removeDraftItem(mealIdx: number, itemIdx: number) {
    setEditedDraft((prev) => {
      if (!prev) return prev
      const meals = prev.meals.map((meal, mi) => {
        if (mi !== mealIdx) return meal
        return { ...meal, items: meal.items.filter((_, ii) => ii !== itemIdx) }
      }).filter((meal) => meal.items.length > 0)
      return { ...prev, meals }
    })
  }

  function addDraftItem(mealIdx: number) {
    setEditedDraft((prev) => {
      if (!prev) return prev
      const meals = prev.meals.map((meal, mi) => {
        if (mi !== mealIdx) return meal
        return {
          ...meal,
          items: [...meal.items, {
            food_name: '',
            quantity_text: null,
            calories: null,
            protein_g: null,
            fat_g: null,
            carbs_g: null,
            fiber_g: null,
            sugar_g: null,
            sodium_mg: null,
            estimate_level: 'estimated' as const,
            source_kind: 'manual' as const,
            needs_review: true,
          }],
        }
      })
      return { ...prev, meals }
    })
  }

  return (
    <div className={`${styles.workspaceRoot} ${calorieDisplayFont.variable} ${calorieMonoFont.variable}`}>
      <div className={styles.atmosphere} aria-hidden="true" />

      {/* Top bar */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.topTitle}>Calorie Atelier</span>
          <div className={styles.topProgress}>
            <div className={styles.topProgressItem}>
              <span>{formatCompact(totals.calories)} / {formatCompact(calorieTarget)} kcal</span>
              <div className={styles.topProgressTrack}>
                <div className={styles.topProgressFill} style={{ width: `${calorieProgress * 100}%` }} />
              </div>
            </div>
            <div className={styles.topProgressItem}>
              <span>{formatNumber(totals.protein_g, 0)} / {formatNumber(proteinTarget, 0)} g 蛋白</span>
              <div className={styles.topProgressTrack}>
                <div className={styles.topProgressFillProtein} style={{ width: `${proteinProgress * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
        <nav className={styles.topNav}>
          <Link href={`/calorie/day/${today}`} className={styles.topNavLink}>日报</Link>
          <Link href="/calorie/reports?period=week" className={styles.topNavLink}>周报</Link>
          <Link href="/calorie/reports?period=month" className={styles.topNavLink}>月报</Link>
        </nav>
      </header>

      {/* Three-panel main area */}
      <div className={styles.mainGrid}>

        {/* Left: Session list */}
        <aside className={styles.sessionPanel}>
          <button
            type="button"
            className={styles.newSessionBtn}
            onClick={() => void handleCreateWorkspace()}
          >
            <Plus size={14} />
            新建会话
          </button>

          <div className={styles.sessionList}>
            {isLoadingWorkspaces && !workspaces ? (
              <div className={styles.sessionLoading}>加载中…</div>
            ) : (workspaces ?? []).map((ws) => (
              <div
                key={ws.id}
                className={`${styles.sessionItem} ${activeWorkspaceId === ws.id ? styles.sessionItemActive : ''}`}
              >
                <button
                  type="button"
                  className={styles.sessionLabel}
                  onClick={() => {
                    startTransition(() => setActiveWorkspaceId(ws.id))
                  }}
                >
                  <span className={styles.sessionDot} />
                  <span>{formatWorkspaceTitle(ws)}</span>
                </button>
                <button
                  type="button"
                  className={styles.sessionDelete}
                  onClick={() => void handleDeleteWorkspace(ws.id)}
                  disabled={isDeletingWorkspaceId === ws.id}
                  aria-label="删除会话"
                >
                  {isDeletingWorkspaceId === ws.id ? <Loader2 size={12} className={styles.spinner} /> : <X size={12} />}
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Chat stream + composer */}
        <section className={styles.chatPanel}>
          {threadError ? (
            <div className={styles.errorBanner}>{threadError.message ?? '工作台加载失败'}</div>
          ) : isLoadingThread && !threadBundle ? (
            <div className={styles.streamSkeleton}>
              <div /><div /><div />
            </div>
          ) : (
            <div ref={streamRef} className={styles.messageStream}>
              {(threadBundle?.messages ?? []).filter((m) => m.role !== 'system').length === 0 ? (
                <div className={styles.chatEmpty}>
                  <MessageSquarePlus size={22} />
                  <strong>还没有对话</strong>
                  <p>在下方输入一餐内容，Agy 会分析并生成营养草稿供你审核。</p>
                </div>
              ) : (threadBundle?.messages ?? []).filter((m) => m.role === 'user' || m.role === 'assistant').map((msg) => {
                const atts = attachmentsByMessageId.get(msg.id) ?? []
                const isUser = msg.role === 'user'

                return (
                  <article key={msg.id} className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAgy}`}>
                    <div className={styles.bubbleMeta}>
                      <span>{isUser ? 'You' : 'Agy'}</span>
                      <time>{formatTime(msg.created_at)}</time>
                    </div>
                    <p className={styles.bubbleText}>{summarizeMessage(msg)}</p>
                    {atts.length > 0 ? (
                      <div className={styles.attachmentRow}>
                        {atts.map((att) => (
                          <span key={att.id} className={styles.attachmentPill}>
                            <Camera size={12} />
                            {typeof att.metadata.filename === 'string' ? att.metadata.filename : att.media_type}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}

          {composerError ? <div className={styles.errorBanner}>{composerError}</div> : null}

          <form className={styles.composer} onSubmit={handleSubmit}>
            <div className={styles.composerRow}>
              <textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                className={styles.composerInput}
                rows={3}
                placeholder="描述一餐内容，或上传包装图。Agy 会先生成草稿供你审核。"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <div className={styles.composerSide}>
                <label className={styles.uploadBtn}>
                  <Camera size={15} />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className={styles.hiddenInput}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      if (files.length > 0) {
                        setQueuedFiles((c) => [...c, ...files])
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </label>
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={isSending || (!draftMessage.trim() && queuedFiles.length === 0) || !activeWorkspaceId}
                >
                  {isSending ? <Loader2 size={15} className={styles.spinner} /> : <SendHorizontal size={15} />}
                </button>
              </div>
            </div>

            {queuedPreviews.length > 0 ? (
              <div className={styles.previewStrip}>
                {queuedPreviews.map(({ file, url }) => (
                  <figure key={`${file.name}-${file.lastModified}`} className={styles.previewCard}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={file.name} className={styles.previewImage} />
                    <button
                      type="button"
                      className={styles.previewRemove}
                      onClick={() => setQueuedFiles((c) => c.filter((f) => f !== file))}
                      aria-label="移除图片"
                    >
                      <X size={12} />
                    </button>
                  </figure>
                ))}
              </div>
            ) : null}

            <div className={styles.composerHint}>
              <Sparkles size={12} />
              所有输出先进草稿 · Cmd+Enter 发送
            </div>
          </form>
        </section>

        {/* Right: Operations panel */}
        <aside className={styles.opsPanel}>
          {editedDraft ? (
            <div className={styles.draftEditor}>
              <div className={styles.draftHeader}>
                <p className={styles.kicker}>待确认草稿</p>
                <span className={styles.draftDate}>{editedDraft.date ?? today}</span>
              </div>

              {editedDraft.summary ? (
                <p className={styles.draftSummary}>{editedDraft.summary}</p>
              ) : null}

              {editedDraft.insights.length > 0 ? (
                <ul className={styles.insightsList}>
                  {editedDraft.insights.map((ins, i) => (
                    <li key={i}>{ins}</li>
                  ))}
                </ul>
              ) : null}

              <div className={styles.draftMeals}>
                {editedDraft.meals.map((meal, mealIdx) => (
                  <section key={mealIdx} className={styles.draftMeal}>
                    <header className={styles.draftMealHeader}>
                      <strong>{formatMealTitle(meal)}</strong>
                      {meal.occurred_at ? <time>{formatTime(meal.occurred_at)}</time> : null}
                    </header>

                    <div className={styles.draftItemsWrapper}>
                      {/* Column headers */}
                      <div className={styles.draftColHeaders}>
                        <span className={styles.draftColName}>食物</span>
                        <span className={styles.draftColQty}>数量</span>
                        {NUTRITION_COLS.map((col) => (
                          <span key={col.key} className={styles.draftColNum}>{col.label}</span>
                        ))}
                        <span />
                      </div>

                      {meal.items.map((item, itemIdx) => (
                        <div key={itemIdx} className={styles.draftItemRow}>
                          <input
                            className={`${styles.draftInput} ${styles.draftInputName}`}
                            value={item.food_name}
                            onChange={(e) => updateDraftItem(mealIdx, itemIdx, 'food_name', e.target.value)}
                            placeholder="食物名称"
                          />
                          <input
                            className={`${styles.draftInput} ${styles.draftInputQty}`}
                            value={item.quantity_text ?? ''}
                            onChange={(e) => updateDraftItem(mealIdx, itemIdx, 'quantity_text', e.target.value)}
                            placeholder="数量"
                          />
                          {NUTRITION_COLS.map((col) => (
                            <input
                              key={col.key}
                              type="number"
                              className={`${styles.draftInput} ${styles.draftInputNum}`}
                              value={item[col.key] ?? ''}
                              onChange={(e) => updateDraftItem(mealIdx, itemIdx, col.key, e.target.value)}
                              placeholder="—"
                            />
                          ))}
                          <button
                            type="button"
                            className={styles.removeItemBtn}
                            onClick={() => removeDraftItem(mealIdx, itemIdx)}
                            aria-label="删除条目"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        className={styles.addItemBtn}
                        onClick={() => addDraftItem(mealIdx)}
                      >
                        <Plus size={12} />
                        添加食物
                      </button>
                    </div>
                  </section>
                ))}
              </div>

              {draftTotals ? (
                <div className={styles.draftTotalsRow}>
                  <span>合计</span>
                  <span>{formatNumber(draftTotals.calories)} kcal</span>
                  <span>{formatNumber(draftTotals.protein_g, 1)} g 蛋白</span>
                  <span>{formatNumber(draftTotals.fat_g, 1)} g 脂肪</span>
                  <span>{formatNumber(draftTotals.carbs_g, 1)} g 碳水</span>
                </div>
              ) : null}

              <div className={styles.draftActions}>
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => void handleDiscardDraft()}
                  disabled={isDiscarding}
                >
                  {isDiscarding ? <Loader2 size={14} className={styles.spinner} /> : <X size={14} />}
                  抛弃
                </button>
                <button
                  type="button"
                  className={styles.commitBtn}
                  onClick={() => void handleCommitDraft()}
                  disabled={isCommitting || !editedDraft.meals.length}
                >
                  {isCommitting ? <Loader2 size={14} className={styles.spinner} /> : <CheckCheck size={14} />}
                  确认入账
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.opsEmpty}>
              <div className={styles.opsEmptyIcon}>
                <Sparkles size={28} />
              </div>
              <strong>操作台空闲</strong>
              <p>在左侧描述今天吃了什么，Agy 会分析并在此显示可编辑的营养草稿。</p>

              {(dayData?.meals.length ?? 0) > 0 ? (
                <div className={styles.todayMeals}>
                  <div className={styles.todayMealsHeader}>
                    <Utensils size={13} />
                    今日已入账餐食
                    <Link href={`/calorie/day/${today}`} className={styles.todayMealsLink}>日账 →</Link>
                  </div>
                  {(dayData?.meals ?? []).map((meal) => (
                    <div key={meal.id} className={styles.committedMealRow}>
                      <span>{formatMealTitle(meal)} · {formatNumber(meal.totals.calories)} kcal</span>
                      <button
                        type="button"
                        className={styles.undoMealBtn}
                        onClick={() => void handleDeleteMeal(meal.id)}
                        disabled={deletingMealId === meal.id}
                        aria-label="撤销该餐"
                      >
                        {deletingMealId === meal.id
                          ? <Loader2 size={11} className={styles.spinner} />
                          : <Trash2 size={11} />}
                        撤销
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
