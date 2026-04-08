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
  countries: Array<{ x: string; y: number }>
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

function buildPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return ''

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

export default function AnalyticsDashboard({ placement }: { placement: 'desktop' | 'mobile' }) {
  const [range, setRange] = useState<RangeKey>('7d')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'

  const { data, error, isLoading, mutate, isValidating } = useSWR(
    `/api/analytics/overview?range=${range}&timezone=${encodeURIComponent(timezone)}`,
    fetcher,
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
    },
  )

  const trendPoints = useMemo(() => {
    const trend = data?.trend || []
    if (!trend.length) return []

    const maxValue = Math.max(...trend.map((item) => item.y), 1)
    const minValue = Math.min(...trend.map((item) => item.y), 0)
    const width = 100
    const height = 40

    return trend.map((item, index) => {
      const x = trend.length === 1 ? width / 2 : (index / (trend.length - 1)) * width
      const normalized = maxValue === minValue ? 0.5 : (item.y - minValue) / (maxValue - minValue)
      const y = height - normalized * height

      return { x, y }
    })
  }, [data?.trend])

  const stats = data?.summary
  const countries = data?.countries || []
  const maxCountryValue = Math.max(...countries.map((country) => country.y), 1)

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
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
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

          <div className="rounded-lg border border-border/60 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground">访问趋势</p>
              <p className="text-[11px] text-muted-foreground">{range === '7d' ? '近7天' : '近30天'}</p>
            </div>
            <svg viewBox="0 0 100 40" className="w-full h-20">
              <path d={buildPath(trendPoints)} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
            </svg>
          </div>

          <div className="rounded-lg border border-border/60 p-2.5">
            <p className="text-[11px] text-muted-foreground mb-2">国家/地区</p>
            <div className="space-y-2">
              {countries.length === 0 && (
                <p className="text-[11px] text-muted-foreground">暂无可展示数据</p>
              )}
              {countries.map((country) => (
                <div key={country.x} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground">{country.x}</span>
                    <span className="text-muted-foreground">{numberFormatter.format(country.y)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.max((country.y / maxCountryValue) * 100, 6)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
