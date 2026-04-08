'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import SpotifyNowPlaying from './SpotifyNowPlaying'
import AnalyticsDashboard from './AnalyticsDashboard'

type UmamiApi = {
  track: (eventName: string, data?: Record<string, string>) => void
}

function trackEvent(eventName: string, data: Record<string, string> = {}) {
  if (typeof window === 'undefined') return

  const umami = (window as Window & { umami?: UmamiApi }).umami
  if (!umami || typeof umami.track !== 'function') return

  umami.track(eventName, data)
}

const tools = [
  {
    href: '/wardrobe',
    label: 'LifeLens',
    description: '智能评价与服装管理系统',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
      </svg>
    ),
    external: false,
  },
  {
    href: 'https://trendradar.arthurlovegrace.top',
    label: 'News',
    description: '每日行业热点聚合汇总',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    ),
    external: true,
  },
  {
    href: '#analytics-dashboard',
    label: 'Analytics',
    description: '站点访问流量实时监控',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    external: false,
    analytics: true,
  },
]

const ToolsCard = memo(function ToolsCard({ id = 'sidebar' }: { id?: string }) {
  const [showAnalytics, setShowAnalytics] = useState(false)

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-border/50 dark:border-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-white/20 p-5">

      {/* Title */}
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase mb-3">
        我的工具
      </h3>

      {/* Tool links */}
      <ul className="space-y-1">
        <li>
          <SpotifyNowPlaying />
        </li>
        {tools.map((tool) => {
          const inner = (
            <div className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted transition-colors duration-150 group cursor-pointer">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-[image:var(--gradient-primary)] group-hover:text-primary-foreground transition duration-200">
                {tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-none mb-0.5">
                  {tool.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-none">
                  {tool.description}
                </p>
              </div>
              {tool.external && (
                <svg className="w-3 h-3 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              )}
            </div>
          )

          return (
            <li key={tool.href}>
              {tool.analytics ? (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    const next = !showAnalytics
                    setShowAnalytics(next)

                    if (next) {
                      trackEvent('analytics_open', { placement: id === 'mobile' ? 'mobile' : 'desktop' })
                    }
                  }}
                  aria-expanded={showAnalytics}
                  aria-controls="analytics-dashboard-panel"
                >
                  {inner}
                </button>
              ) : tool.external ? (
                <a href={tool.href} target="_blank" rel="noopener noreferrer">
                  {inner}
                </a>
              ) : (
                <Link href={tool.href}>{inner}</Link>
              )}
            </li>
          )
        })}
      </ul>

      {showAnalytics && (
        <div id="analytics-dashboard-panel">
          <AnalyticsDashboard placement={id === 'mobile' ? 'mobile' : 'desktop'} />
        </div>
      )}

    </div>
  )
})

export default ToolsCard
