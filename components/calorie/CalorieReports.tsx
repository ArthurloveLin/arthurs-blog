'use client'

import Link from 'next/link'
import { startTransition, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Activity, ArrowLeft, ArrowUpRight, Flame, Layers3, Sparkles } from 'lucide-react'

import {
  calorieDisplayFont,
  calorieMonoFont,
  type ReportResponse,
  fetcher,
  formatCompact,
  formatDateLabel,
  formatNumber,
} from './client'
import styles from './CalorieReports.module.css'

type ReportPeriod = 'day' | 'week' | 'month'

function formatSourceKind(sourceKind: string) {
  return {
    agent: 'Agent',
    knowledge_db: 'Knowledge DB',
    reference_override: 'Override',
    ocr: 'OCR',
    manual: 'Manual',
  }[sourceKind] ?? sourceKind
}

export default function CalorieReports() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [anchor, setAnchor] = useState(today)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    `/api/calorie/reports?period=${period}&anchor=${encodeURIComponent(anchor)}`,
    fetcher,
    {
      dedupingInterval: 20_000,
      revalidateOnFocus: false,
    },
  )

  const dailyAverageCalories = data?.days.length ? data.totals.calories / data.days.length : 0
  const dailyAverageProtein = data?.days.length ? data.totals.protein_g / data.days.length : 0
  const maxDayCalories = Math.max(...(data?.days.map((day) => day.totals.calories) ?? [1]))

  return (
    <div className={`${styles.root} ${calorieDisplayFont.variable} ${calorieMonoFont.variable}`}>
      <div className={styles.atmosphere} aria-hidden="true" />

      <section className={styles.heroShell}>
        <div className={styles.heroCard}>
          <div className={styles.heroNav}>
            <Link href="/calorie" className={styles.navLink}>
              <ArrowLeft size={15} /> 返回工作台
            </Link>
            <Link href={`/calorie/day/${anchor}`} className={styles.navLink}>
              查看锚点日账 <ArrowUpRight size={15} />
            </Link>
          </div>

          <p className={styles.eyebrow}>Nutrition signal board</p>
          <h1>Reports & Signals</h1>
          <p className={styles.subtitle}>
            把正式入账后的数据压成趋势、来源分布和估算占比。这里不看草稿，只看已经成账的结果。
          </p>
        </div>
      </section>

      <section className={styles.controlShell}>
        <div className={styles.toolbar}>
          <div className={styles.periodButtons}>
            {(['day', 'week', 'month'] as ReportPeriod[]).map((nextPeriod) => (
              <button
                key={nextPeriod}
                type="button"
                className={nextPeriod === period ? styles.periodButtonActive : styles.periodButton}
                onClick={() => {
                  startTransition(() => {
                    setPeriod(nextPeriod)
                  })
                }}
              >
                {nextPeriod}
              </button>
            ))}
          </div>

          <div className={styles.anchorField}>
            <label htmlFor="calorie-report-anchor">Anchor</label>
            <input
              id="calorie-report-anchor"
              type="date"
              value={anchor}
              onChange={(event) => setAnchor(event.target.value)}
            />
            <button type="button" className={styles.refreshButton} onClick={() => { void mutate() }}>
              刷新
            </button>
          </div>
        </div>

        {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span><Flame size={14} /> Total kcal</span>
            <strong>{formatCompact(data?.totals.calories)}</strong>
            <p>{data?.dateRange.start ?? '--'} → {data?.dateRange.end ?? '--'}</p>
          </article>
          <article className={styles.summaryCard}>
            <span><Activity size={14} /> Avg day</span>
            <strong>{formatNumber(dailyAverageCalories)}</strong>
            <p>{formatNumber(dailyAverageProtein, 1)} g protein / day</p>
          </article>
          <article className={styles.summaryCard}>
            <span><Layers3 size={14} /> Estimate ratio</span>
            <strong>{Math.round((data?.estimateRatio ?? 0) * 100)}%</strong>
            <p>估算占比越高，越值得回补包装或称重信息。</p>
          </article>
        </div>

        <div className={styles.reportGrid}>
          <section className={styles.reportPanel}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Trend</p>
                <h2>摄入走势</h2>
              </div>
            </header>

            {isLoading && !data ? (
              <div className={styles.loadingState}>报表加载中…</div>
            ) : data?.days.length ? (
              <div className={styles.chartBoard}>
                {data.days.map((day) => (
                  <div key={day.date} className={styles.barColumn}>
                    <div className={styles.barValue}>{formatNumber(day.totals.calories)}</div>
                    <div className={styles.barTrack}>
                      <div style={{ height: `${Math.max((day.totals.calories / maxDayCalories) * 100, day.totals.calories > 0 ? 7 : 0)}%` }} />
                    </div>
                    <div className={styles.barLabel}>{formatDateLabel(day.date)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>当前区间还没有正式入账数据。</div>
            )}
          </section>

          <section className={styles.reportPanel}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Sources</p>
                <h2>来源拆解</h2>
              </div>
            </header>

            <div className={styles.sourceList}>
              {(data?.sourceSummary ?? []).map((source) => (
                <article key={source.sourceKind} className={styles.sourceCard}>
                  <div>
                    <strong>{formatSourceKind(source.sourceKind)}</strong>
                    <span>{source.entries} entries</span>
                  </div>
                  <p>{formatNumber(source.calories)} kcal</p>
                </article>
              ))}
              {!data?.sourceSummary.length ? <div className={styles.emptyState}>暂无来源统计。</div> : null}
            </div>
          </section>

          <section className={`${styles.reportPanel} ${styles.insightPanel}`}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Readout</p>
                <h2>简报结论</h2>
              </div>
            </header>

            <div className={styles.insightList}>
              {(data?.insights ?? []).map((insight) => (
                <article key={insight} className={styles.insightCard}>
                  <Sparkles size={16} />
                  <p>{insight}</p>
                </article>
              ))}
              {!data?.insights.length ? <div className={styles.emptyState}>当前区间尚未生成统计洞察。</div> : null}
            </div>
          </section>

          <section className={styles.reportPanel}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Targets</p>
                <h2>目标对照</h2>
              </div>
            </header>

            <div className={styles.targetTable}>
              {(data?.days ?? []).map((day) => (
                <div key={day.date} className={styles.targetRow}>
                  <div>
                    <strong>{formatDateLabel(day.date)}</strong>
                    <span>{formatNumber(day.targets.calories)} kcal target</span>
                  </div>
                  <div>
                    <strong>{formatNumber(day.totals.calories)}</strong>
                    <span>{formatNumber(day.totals.protein_g, 1)} g 蛋白</span>
                  </div>
                </div>
              ))}
              {!data?.days.length ? <div className={styles.emptyState}>暂无日级目标对照。</div> : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}