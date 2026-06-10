// Tag cloud derived from the resident message set.
'use client'

import { useState } from 'react'
import { ChevronDown, Tag, X } from 'lucide-react'
import type {} from '@/lib/memo-habits'
import type {} from '@/lib/note-boards'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'

export function SidebarTagCloud() {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [isExpanded, setIsExpanded] = useState(false)

  if (state.allTags.length === 0) return null

  const needsExpansion = state.allTags.length > 8

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--memo-shell-muted)]">
          <Tag size={11} />
          标签
        </p>
        {needsExpansion ? (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground/60 transition hover:text-muted-foreground"
          >
            {isExpanded ? '收起' : '展开'}
            <ChevronDown
              size={12}
              className={['transition-transform duration-200', isExpanded ? 'rotate-180' : ''].join(' ')}
            />
          </button>
        ) : null}
      </div>
      <div className="relative">
        <div
          className={[
            'flex flex-wrap gap-1.5 transition-all duration-300',
            !isExpanded && needsExpansion ? 'max-h-[268px] overflow-hidden' : '',
          ].join(' ')}
        >
          {state.allTags.map(({ name, count }) => {
            const isActive = state.activeTags.includes(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => actions.handleTagFilter(name)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground',
                ].join(' ')}
              >
                <span>#{name}</span>
                <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
        {!isExpanded && needsExpansion ? (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--memo-panel-surface,hsl(var(--background)))] to-transparent" />
        ) : null}
      </div>
      {state.activeTags.length > 0 ? (
        <button
          type="button"
          onClick={() => actions.handleTagFilter('')}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
          清除筛选
        </button>
      ) : null}
    </div>
  )
}

