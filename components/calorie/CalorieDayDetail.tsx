'use client'

import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import { ArrowLeft, ArrowUpRight, CheckCheck, NotebookText, Save, Scale, Waves, Wheat } from 'lucide-react'

import {
  calorieDisplayFont,
  calorieMonoFont,
  type DayResponse,
  fetcher,
  formatDateLabel,
  formatMealTitle,
  formatNumber,
  formatTime,
  normalizeNutritionTotals,
  requestJson,
} from './client'
import styles from './CalorieDayDetail.module.css'

interface DaySettingsFormProps {
  date: string
  dayLog: DayResponse['dayLog']
  onSaved(nextDay: DayResponse): Promise<void>
}

function DaySettingsForm({ date, dayLog, onSaved }: DaySettingsFormProps) {
  const [targetCalories, setTargetCalories] = useState(() => String(dayLog?.target_calories ?? 1900))
  const [targetProtein, setTargetProtein] = useState(() => String(dayLog?.target_protein_g ?? 130))
  const [notes, setNotes] = useState(() => dayLog?.notes ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveState('saving')
    setSaveError(null)

    try {
      const nextDay = await requestJson<DayResponse>(`/api/calorie/days/${date}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetCalories: Number(targetCalories),
          targetProteinG: Number(targetProtein),
          notes,
        }),
      })

      await onSaved(nextDay)
      setSaveState('saved')
    } catch (requestError) {
      setSaveState('error')
      setSaveError(requestError instanceof Error ? requestError.message : '保存失败，请稍后重试')
    }
  }

  return (
    <form className={styles.targetForm} onSubmit={handleSave}>
      <label>
        <span><Scale size={14} /> 目标热量</span>
        <input value={targetCalories} onChange={(event) => setTargetCalories(event.target.value)} inputMode="numeric" />
      </label>

      <label>
        <span><CheckCheck size={14} /> 目标蛋白</span>
        <input value={targetProtein} onChange={(event) => setTargetProtein(event.target.value)} inputMode="decimal" />
      </label>

      <label>
        <span><NotebookText size={14} /> 日志备注</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} />
      </label>

      {saveError ? <div className={styles.errorBanner}>{saveError}</div> : null}

      <button type="submit" className={styles.saveButton} disabled={saveState === 'saving'}>
        <Save size={15} />
        {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : '保存设置'}
      </button>
    </form>
  )
}

export default function CalorieDayDetail({ date }: { date: string }) {
  const { data, error, isLoading, mutate } = useSWR<DayResponse>(`/api/calorie/days/${date}`, fetcher, {
    dedupingInterval: 15_000,
    revalidateOnFocus: false,
  })

  const totals = normalizeNutritionTotals(data?.totals)
  const calorieProgress = (data?.dayLog?.target_calories ?? 1900) > 0
    ? totals.calories / (data?.dayLog?.target_calories ?? 1900)
    : 0
  const proteinProgress = (data?.dayLog?.target_protein_g ?? 130) > 0
    ? totals.protein_g / (data?.dayLog?.target_protein_g ?? 130)
    : 0

  const formSeed = `${date}:${data?.dayLog?.target_calories ?? 1900}:${data?.dayLog?.target_protein_g ?? 130}:${data?.dayLog?.notes ?? ''}`

  return (
    <div className={`${styles.root} ${calorieDisplayFont.variable} ${calorieMonoFont.variable}`}>
      <div className={styles.atmosphere} aria-hidden="true" />

      <section className={styles.heroShell}>
        <div className={styles.heroCard}>
          <div className={styles.heroNav}>
            <Link href="/calorie" className={styles.backLink}>
              <ArrowLeft size={15} /> 返回工作台
            </Link>
            <Link href="/calorie/reports" className={styles.jumpLink}>
              去看报表 <ArrowUpRight size={15} />
            </Link>
          </div>

          <p className={styles.eyebrow}>Day ledger</p>
          <h1>{formatDateLabel(date)} 的营养账页</h1>
          <p className={styles.subtitle}>
            这一页偏向账本视角：看当天的正式入账、复核率、目标值和每餐拆解。
          </p>
        </div>
      </section>

      <section className={styles.sheetShell}>
        {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

        <div className={styles.overviewGrid}>
          <article className={styles.overviewCard}>
            <span>Calories</span>
            <strong>{formatNumber(totals.calories)}</strong>
            <div className={styles.progressRail}><div style={{ width: `${Math.min(calorieProgress * 100, 100)}%` }} /></div>
            <p>目标 {formatNumber(data?.dayLog?.target_calories ?? 1900)} kcal</p>
          </article>
          <article className={styles.overviewCard}>
            <span>Protein</span>
            <strong>{formatNumber(totals.protein_g, 1)}</strong>
            <div className={styles.progressRail}><div style={{ width: `${Math.min(proteinProgress * 100, 100)}%` }} /></div>
            <p>目标 {formatNumber(data?.dayLog?.target_protein_g ?? 130)} g</p>
          </article>
          <article className={styles.overviewCard}>
            <span>Meals</span>
            <strong>{data?.summary.mealCount ?? 0}</strong>
            <p>条目 {data?.summary.entryCount ?? 0}</p>
          </article>
          <article className={styles.overviewCard}>
            <span>Reviewed</span>
            <strong>{data?.summary.entryCount ? Math.round((data.summary.reviewedEntryCount / data.summary.entryCount) * 100) : 0}%</strong>
            <p>{data?.summary.reviewedEntryCount ?? 0} 个条目已确认</p>
          </article>
        </div>

        <div className={styles.bodyGrid}>
          <section className={styles.ledgerPanel}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Recorded meals</p>
                <h2>餐次与条目</h2>
              </div>
            </header>

            {isLoading && !data ? (
              <div className={styles.loadingState}>账页加载中…</div>
            ) : data?.meals.length ? (
              <div className={styles.mealStack}>
                {data.meals.map((meal) => (
                  <article key={meal.id} className={styles.mealCard}>
                    <header>
                      <div>
                        <strong>{formatMealTitle(meal)}</strong>
                        <span>{formatTime(meal.occurred_at)}</span>
                      </div>
                      <div className={styles.mealTotals}>
                        <span>{formatNumber(meal.totals.calories)} kcal</span>
                        <span>{formatNumber(meal.totals.protein_g, 1)} g 蛋白</span>
                      </div>
                    </header>

                    <div className={styles.itemTable}>
                      <div className={styles.itemTableHead}>
                        <span>Food</span>
                        <span>Kcal</span>
                        <span>Protein</span>
                        <span>Notes</span>
                      </div>

                      {meal.items.map((item) => (
                        <div key={`${meal.id}-${item.food_name}-${item.quantity_text ?? 'unit'}`} className={styles.itemRow}>
                          <div>
                            <strong>{item.food_name}</strong>
                            <span>{item.quantity_text ?? '1 份'}</span>
                          </div>
                          <span>{formatNumber(item.calories)}</span>
                          <span>{formatNumber(item.protein_g, 1)} g</span>
                          <span>{item.estimate_level ?? 'n/a'}{item.needs_review ? ' · 待复核' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <NotebookText size={18} />
                这一天还没有正式入账的餐次。
              </div>
            )}
          </section>

          <aside className={styles.sideColumn}>
            <section className={styles.controlPanel}>
              <header className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>Targets</p>
                  <h2>目标与备注</h2>
                </div>
              </header>

              <DaySettingsForm
                key={formSeed}
                date={date}
                dayLog={data?.dayLog ?? null}
                onSaved={async (nextDay) => {
                  await mutate(nextDay, { revalidate: false })
                }}
              />
            </section>

            <section className={styles.controlPanel}>
              <header className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>Composition</p>
                  <h2>宏量概览</h2>
                </div>
              </header>

              <div className={styles.macroList}>
                <div>
                  <span><Wheat size={14} /> 碳水</span>
                  <strong>{formatNumber(totals.carbs_g, 1)} g</strong>
                </div>
                <div>
                  <span><Waves size={14} /> 脂肪</span>
                  <strong>{formatNumber(totals.fat_g, 1)} g</strong>
                </div>
                <div>
                  <span><CheckCheck size={14} /> 纤维</span>
                  <strong>{formatNumber(totals.fiber_g, 1)} g</strong>
                </div>
                <div>
                  <span><Scale size={14} /> 钠</span>
                  <strong>{formatNumber(totals.sodium_mg)} mg</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  )
}