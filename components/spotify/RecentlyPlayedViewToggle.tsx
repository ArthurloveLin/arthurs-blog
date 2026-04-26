'use client'

type RecentlyPlayedView = 'timeline' | 'chart' | 'stream'

const VIEW_OPTIONS: Array<{ id: RecentlyPlayedView; label: string }> = [
  { id: 'timeline', label: '时间轴' },
  { id: 'chart', label: '分布图' },
  { id: 'stream', label: '标签流' },
]

export default function RecentlyPlayedViewToggle({
  view,
  onChange,
}: {
  view: RecentlyPlayedView
  onChange: (view: RecentlyPlayedView) => void
}) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-border/70 bg-background/80 p-0.5">
      {VIEW_OPTIONS.map((option) => {
        const isActive = option.id === view

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              isActive
                ? 'bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.12)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}