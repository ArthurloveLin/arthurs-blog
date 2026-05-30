'use client'

import { memo, useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import SidebarCard from './SidebarCard'
import { useSiteTags } from './SiteDataProvider'
import { ChevronDown } from 'lucide-react'

interface TagsCloudCardProps {
  activeTags?: string[]
}

function getTagDelay(tag: string): number {
  let hash = 0
  for (const character of tag) {
    hash = (hash * 31 + character.charCodeAt(0)) % 200
  }
  return hash
}

function buildTagsUrl(activeTags: string[], toggleTag: string): string {
  const isActive = activeTags.includes(toggleTag)
  if (isActive) return '/'
  return `/tag/${toggleTag}`
}

const TagsCloudCard = memo(function TagsCloudCard({ activeTags = [] }: TagsCloudCardProps) {
  const tags = useSiteTags()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when expanded
  useEffect(() => {
    if (isExpanded && !isMobile && containerRef.current) {
      // Use a brief delay to allow the expansion animation to begin
      const timer = setTimeout(() => {
        containerRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isExpanded, isMobile])

  const tagDelays = useMemo(() => {
    const map = new Map<string, number>()
    if (!isExpanded || isMobile) return map
    
    tags.forEach(({ tag }) => map.set(tag, getTagDelay(tag)))
    return map
  }, [tags, isExpanded, isMobile])

  const processedTags = useMemo(() => {
    if (tags.length === 0) return []
    
    // 1. Sort by count (descending)
    const sorted = [...tags].sort((a, b) => b.count - a.count)
    
    if (!isExpanded || isMobile) return sorted

    // 2. For expanded "Cloud" view: Reorder for center-weighted distribution
    // This puts largest in the middle of the array
    const reordered: typeof tags = []
    sorted.forEach((tag, i) => {
      if (i % 2 === 0) reordered.push(tag)
      else reordered.unshift(tag)
    })
    
    return reordered
  }, [tags, isExpanded, isMobile])

  const { maxCount, minCount } = useMemo(() => {
    if (tags.length === 0) return { maxCount: 0, minCount: 0 }
    const counts = tags.map(t => t.count)
    return {
      maxCount: Math.max(...counts),
      minCount: Math.min(...counts)
    }
  }, [tags])

  if (tags.length === 0) return null

  return (
    <SidebarCard
      ref={containerRef}
      className="overflow-hidden"
      title="标签"
      titleAccessory={
        tags.length > 10 ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest flex items-center gap-1 group"
          >
            {isExpanded ? '收起' : '展开'}
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              strokeWidth={2.5}
            />
          </button>
        ) : (
          <></>
        )
      }
    >

      {/* Tags Cloud Container */}
      <div className="relative group/tags">
        <div 
          className={`flex flex-wrap gap-x-2 gap-y-2 transition-all duration-500 ease-in-out origin-top ${
            isExpanded 
              ? 'justify-center items-center py-6 min-h-[300px]' 
              : 'max-h-[155px] overflow-hidden'
          }`}
        >
          {processedTags.map(({ tag, count }) => {
            const isActive = activeTags.includes(tag)
            
            // Calculate weight-based aesthetics
            const weight = maxCount === minCount ? 0 : (count - minCount) / (maxCount - minCount)
            
            // Expanded view size: 0.8rem to 1.6rem
            // Collapsed view size: 0.875rem (sm)
            const fontSize = isExpanded 
              ? `${0.8 + weight * 0.8}rem` 
              : '0.875rem'

            // Opacity: high frequency = more solid
            const opacity = isExpanded ? 0.6 + weight * 0.4 : 1

            return (
              <Link
                key={tag}
                href={buildTagsUrl(activeTags, tag)}
                scroll={false}
                style={{
                  fontSize,
                  opacity,
                  transitionDelay: isExpanded && !isMobile ? `${tagDelays.get(tag) ?? 0}ms` : '0ms'
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition-all duration-300 hover:scale-110 active:scale-95 ${
                  isActive
                    ? 'bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/20 scale-105 z-10'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/40'
                } ${isExpanded && weight > 0.8 ? 'font-bold shadow-sm' : ''} ${isExpanded ? 'hover:shadow-xl hover:shadow-primary/10 hover:z-20' : ''}`}
              >
                <span className="whitespace-nowrap tracking-tight">{tag}</span>
                <span className={`text-[10px] tabular-nums font-bold transition-opacity duration-300 ${isActive ? 'text-primary-foreground/90' : 'text-muted-foreground/60 group-hover/tags:opacity-100'}`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Fade-out mask for collapsed state */}
        {!isExpanded && tags.length > 8 && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none transition-opacity duration-300 group-hover/tags:opacity-0" />
        )}
      </div>

    </SidebarCard>
  )
})

export default TagsCloudCard
