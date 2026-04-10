'use client'

import { memo, useState, startTransition, unstable_addTransitionType as addTransitionType } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import SpotifyNowPlaying from './SpotifyNowPlaying'
import { ShoppingBag, Newspaper, BarChart2, ExternalLink, Camera } from 'lucide-react'

const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), { ssr: false })

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
    href: '/life-gallery',
    label: 'Life Gallery',
    description: '我的生活画廊与轮播图集',
    icon: <Camera className="w-4 h-4" strokeWidth={1.75} />,
    external: false,
  },
  {
    href: '/wardrobe',
    label: 'LifeLens',
    description: '智能评价与服装管理系统',
    icon: <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />,
    external: false,
  },
  {
    href: '/trend-radar',
    label: 'News',
    description: '每日行业热点聚合汇总',
    icon: <Newspaper className="w-4 h-4" strokeWidth={1.75} />,
    external: false,
  },
  {
    href: '#analytics-dashboard',
    label: 'Analytics',
    description: '站点访问流量实时监控',
    icon: <BarChart2 className="w-4 h-4" strokeWidth={1.75} />,
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
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all duration-300 relative overflow-hidden">
                {/* Gaussian Blur Glow */}
                <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-15 blur-md transition-opacity duration-500" />
                <div className="relative z-10">{tool.icon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-none mb-0.5">
                  {tool.label}
                </p>
                <p className="text-xs text-foreground/60 leading-none">
                  {tool.description}
                </p>
              </div>
              {tool.external && (
                <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" strokeWidth={2} />
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
                <Link
                  href={tool.href}
                  onClick={() => startTransition(() => { addTransitionType('nav-forward') })}
                >
                  {inner}
                </Link>
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
