'use client'

import { memo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import SpotifyNowPlaying from './SpotifyNowPlaying'
import { ShoppingBag, Newspaper, BarChart2, ExternalLink, Camera, NotebookText } from 'lucide-react'

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
    label: 'Life Lens',
    description: '记录对事物的真实评价',
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
    href: '/memo',
    label: 'Memo',
    description: '以便签墙形式展开的私人备忘录',
    icon: <NotebookText className="w-4 h-4" strokeWidth={1.75} />,
    external: false,
  },
]

function ToolRow({
  icon,
  label,
  description,
  external,
}: {
  icon: React.ReactNode
  label: string
  description: string
  external?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted transition-colors duration-150 group cursor-pointer">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-15 blur-md transition-opacity duration-500" />
        <div className="relative z-10">{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-none mb-0.5">
          {label}
        </p>
        <p className="text-xs text-foreground/60 leading-none">
          {description}
        </p>
      </div>
      {external && (
        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" strokeWidth={2} />
      )}
    </div>
  )
}

function AnalyticsToolSection({
  isOpen,
  onToggle,
  placement,
}: {
  isOpen: boolean
  onToggle: () => void
  placement: 'mobile' | 'desktop'
}) {
  return (
    <>
      <li>
        <button
          type="button"
          className="w-full text-left"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls="analytics-dashboard-panel"
        >
          <ToolRow
            icon={<BarChart2 className="w-4 h-4" strokeWidth={1.75} />}
            label="Analytics"
            description="站点访问流量实时监控"
          />
        </button>
      </li>
      {isOpen && (
        <li id="analytics-dashboard-panel">
          <AnalyticsDashboard placement={placement} />
        </li>
      )}
    </>
  )
}

const ToolsCard = memo(function ToolsCard({ id = 'sidebar' }: { id?: string }) {
  const placement = id === 'mobile' ? 'mobile' : 'desktop'
  const [activePanel, setActivePanel] = useState<'analytics' | null>(null)

  const toggleAnalyticsPanel = () => {
    const nextPanel = activePanel === 'analytics' ? null : 'analytics'
    setActivePanel(nextPanel)

    if (nextPanel === 'analytics') {
      trackEvent('analytics_open', { placement })
    }
  }

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
          return (
            <li key={tool.href}>
              {tool.external ? (
                <a href={tool.href} target="_blank" rel="noopener noreferrer">
                  <ToolRow
                    icon={tool.icon}
                    label={tool.label}
                    description={tool.description}
                    external
                  />
                </a>
              ) : (
                <Link
                  href={tool.href}
                  transitionTypes={['nav-forward']}
                >
                  <ToolRow
                    icon={tool.icon}
                    label={tool.label}
                    description={tool.description}
                  />
                </Link>
              )}
            </li>
          )
        })}
        <AnalyticsToolSection
          isOpen={activePanel === 'analytics'}
          onToggle={toggleAnalyticsPanel}
          placement={placement}
        />
      </ul>

    </div>
  )
})

export default ToolsCard
