'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'

type RangeKey = '7d' | '30d'

type AnalyticsResponse = {
  range: RangeKey
  startAt: number
  endAt: number
  summary: {
    pageviews: number
    visitors: number
    visits: number
    realtime: number
  }
  trend: Array<{ x: string; y: number }>
  performance: Record<string, { p50: number; p75: number; p95: number }> | null
}

const fetcher = async (url: string): Promise<AnalyticsResponse> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('analytics-api-failed')
  }

  return response.json() as Promise<AnalyticsResponse>
}

const numberFormatter = new Intl.NumberFormat('zh-CN')

type UmamiApi = {
  track: (eventName: string, data?: Record<string, string>) => void
}

function trackEvent(eventName: string, data: Record<string, string> = {}) {
  if (typeof window === 'undefined') return

  const umami = (window as Window & { umami?: UmamiApi }).umami
  if (!umami || typeof umami.track !== 'function') return

  umami.track(eventName, data)
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  return numberFormatter.format(value)
}

function getPerformanceStatus(metric: string, value: number) {
  if (metric === 'lcp') {
    if (value <= 2500) return 'good'
    if (value <= 4000) return 'needs-improvement'
    return 'poor'
  }
  if (metric === 'cls') {
    if (value <= 0.1) return 'good'
    if (value <= 0.25) return 'needs-improvement'
    return 'poor'
  }
  if (metric === 'inp') {
    if (value <= 200) return 'good'
    if (value <= 500) return 'needs-improvement'
    return 'poor'
  }
  if (metric === 'fcp') {
    if (value <= 1800) return 'good'
    if (value <= 3000) return 'needs-improvement'
    return 'poor'
  }
  if (metric === 'ttfb') {
    if (value <= 800) return 'good'
    if (value <= 1800) return 'needs-improvement'
    return 'poor'
  }
  return 'unknown'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'good': return 'text-emerald-500'
    case 'needs-improvement': return 'text-amber-500'
    case 'poor': return 'text-rose-500'
    default: return 'text-muted-foreground'
  }
}

function formatMetricValue(metric: string, value: number) {
  if (metric === 'cls') return value.toFixed(3)
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`
  return `${Math.round(value)}ms`
}

export default function AnalyticsDashboard({ placement }: { placement: 'desktop' | 'mobile' }) {
  const [range, setRange] = useState<RangeKey>('7d')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'

  const { data, error, isLoading, mutate, isValidating } = useSWR(
    `/api/analytics/overview?range=${range}&timezone=${encodeURIComponent(timezone)}`,
    fetcher,
    {
      dedupingInterval: 120_000,
      revalidateOnFocus: false,
    },
  )

  const trendBars = useMemo(() => {
    const trend = data?.trend || []
    if (!trend.length) return []
    const maxValue = Math.max(...trend.map((item) => item.y), 1)
    return trend.map((item) => ({
      label: item.x,
      value: item.y,
      pct: maxValue === 0 ? 0 : Math.max((item.y / maxValue) * 100, item.y > 0 ? 4 : 0),
    }))
  }, [data?.trend])

  const stats = data?.summary
  const performance = data?.performance

  return (
    <section className="mt-4 rounded-xl border border-border/60 bg-background/80 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-xs tracking-[0.16em] uppercase text-muted-foreground font-semibold">
          Analytics 看板
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setRange('7d')
              trackEvent('analytics_range_change', { range: '7d', placement })
            }}
            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
              range === '7d'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            7天
          </button>
          <button
            type="button"
            onClick={() => {
              setRange('30d')
              trackEvent('analytics_range_change', { range: '30d', placement })
            }}
            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
              range === '30d'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            30天
          </button>
          <button
            type="button"
            onClick={() => {
              trackEvent('analytics_refresh', { range, placement })
              void mutate()
            }}
            className="px-2 py-1 text-[11px] rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            刷新
          </button>
        </div>
      </div>

      {(isLoading || isValidating) && !data && (
        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-2 gap-2">
            <div className="h-14 rounded-lg bg-muted" />
            <div className="h-14 rounded-lg bg-muted" />
            <div className="h-14 rounded-lg bg-muted" />
            <div className="h-14 rounded-lg bg-muted" />
          </div>
          <div className="h-20 rounded-lg bg-muted" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive mb-2">拉取 Umami 数据失败，请稍后重试。</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="text-xs px-2 py-1 rounded-md border border-destructive/40 text-destructive"
          >
            重新加载
          </button>
        </div>
      )}

      {!error && data && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 p-2.5">
              <p className="text-[11px] text-muted-foreground">Pageviews</p>
              <p className="text-sm font-semibold mt-1">{formatCompactNumber(stats.pageviews)}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5">
              <p className="text-[11px] text-muted-foreground">Visitors</p>
              <p className="text-sm font-semibold mt-1">{formatCompactNumber(stats.visitors)}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5">
              <p className="text-[11px] text-muted-foreground">Visits</p>
              <p className="text-sm font-semibold mt-1">{formatCompactNumber(stats.visits)}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5">
              <p className="text-[11px] text-muted-foreground">Realtime</p>
              <p className="text-sm font-semibold mt-1">{formatCompactNumber(stats.realtime)}</p>
            </div>
          </div>

          {performance && (
            <div className="rounded-lg border border-border/60 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground">性能指标 (p75)</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['lcp', 'cls', 'inp'].map((key) => {
                  const val = performance[key]?.p75
                  if (val === undefined || val === null) return null
                  const status = getPerformanceStatus(key, val)
                  return (
                    <div key={key} className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                      <p className={`text-xs font-medium mt-0.5 ${getStatusColor(status)}`}>
                        {formatMetricValue(key, val)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {trendBars.length > 0 && (
            <div className="rounded-lg border border-border/60 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground">访问趋势</p>
                <p className="text-[11px] text-muted-foreground">{range === '7d' ? '近7天' : '近30天'}</p>
              </div>
              <div className="flex items-end gap-px h-14">
                {trendBars.map((bar) => (
                  <div
                    key={bar.label}
                    className="flex-1 bg-primary/50 hover:bg-primary/80 rounded-sm transition-colors"
                    style={{ height: `${bar.pct}%` }}
                    title={`${bar.label}: ${numberFormatter.format(bar.value)}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
