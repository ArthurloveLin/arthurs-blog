'use client'

import { useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import useSWR from 'swr'

import styles from './SpotifyRecentlyPlayedDeck.module.css'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const TAGS = [
  { key: 'pop',       label: '流行',  color: '#6ee7b7' },
  { key: 'rock',      label: '摇滚',  color: '#f97316' },
  { key: 'rnb',       label: 'R&B',   color: '#a78bfa' },
  { key: 'electronic',label: '电子',  color: '#38bdf8' },
  { key: 'folk',      label: '民谣',  color: '#fbbf24' },
  { key: 'classical', label: '古典',  color: '#34d399' },
  { key: 'hiphop',    label: '嘻哈',  color: '#fb7185' },
  { key: 'jazz',      label: '爵士',  color: '#c084fc' },
]

type StreamDim = 'hour' | 'day' | 'week' | 'month'

const DIMS: { key: StreamDim; label: string }[] = [
  { key: 'hour',  label: '24h' },
  { key: 'day',   label: '周' },
  { key: 'week',  label: '月' },
  { key: 'month', label: '年' },
]

export default function SpotifyTagStreamChart() {
  const [activeDim, setActiveDim] = useState<StreamDim>('day')
  const { data: allData, isLoading } = useSWR('/api/spotify/history/stream', fetcher)
  
  const [tooltip, setTooltip] = useState<{ xi: number, xPx: number, leftPct: string, tag: typeof TAGS[0], value: number, label: string } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [mouseX, setMouseX] = useState<number | null>(null)

  const data = allData ? allData[activeDim] : null

  const series = useMemo(() => {
    if (!data) return [] as d3.Series<Record<string, number>, string>[]
    const stack = d3.stack<unknown, Record<string, number>, string>()
      .keys(d3.range(TAGS.length).map(String))
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut)

    const tableData = d3.range(data.n).map(xi => {
      const row: Record<string, number> = { i: xi }
      TAGS.forEach((_, ti) => { row[String(ti)] = data.raw[ti][xi] })
      return row
    })
    return stack(tableData)
  }, [data])

  if (isLoading) {
    return (
      <div className={styles.chartPanel} style={{ minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-muted-foreground text-sm">加载标签流数据中...</p>
      </div>
    )
  }

  if (!data || series.length === 0) {
    return (
      <div className={styles.chartPanel} style={{ minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-muted-foreground text-sm">暂无数据</p>
      </div>
    )
  }

  const W = 820
  const H = 260
  const PL = 16, PR = 16, PT = 24, PB = 40
  const innerW = W - PL - PR
  const innerH = H - PT - PB

  const xScale = d3.scaleLinear().domain([0, data.n - 1]).range([0, innerW])
  const allVals = series.flatMap(s => (s as unknown as d3.SeriesPoint<Record<string, number>>[]).flatMap(d => [d[0], d[1]]))
  const yMin = (d3.min(allVals) as number) ?? 0
  const yMax = (d3.max(allVals) as number) ?? 1
  // Add some padding to Y scale so the wiggle fits nicely
  const yDiff = yMax - yMin
  const yScale = d3.scaleLinear().domain([yMin - yDiff * 0.1, yMax + yDiff * 0.1]).range([innerH, 0]).nice()

  const area = d3.area<d3.SeriesPoint<Record<string, number>>>()
    .x((d, i) => xScale(i))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCatmullRom.alpha(0.5))

  function handleSvgMove(e: React.MouseEvent) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    // Handle responsive scaling
    const scaleX = W / rect.width
    const relX = (e.clientX - rect.left) * scaleX - PL
    const xi = Math.round(xScale.invert(relX))
    if (xi >= 0 && xi < data.n) {
      setMouseX(xScale(xi))
      let maxBand = -Infinity, maxTi = 0
      series.forEach((s, ti) => {
        const point = (s as unknown as d3.SeriesPoint<Record<string, number>>[])[xi]
        if (!point) return
        const band = point[1] - point[0]
        if (band > maxBand) { maxBand = band; maxTi = ti }
      })
      setTooltip({ 
        xi, 
        xPx: xScale(xi) / scaleX,
        leftPct: Math.min(Math.max(( (xScale(xi) / scaleX) / rect.width) * 100, 0), 80) + '%',
        tag: TAGS[maxTi], 
        value: data.raw[maxTi][xi], 
        label: data.labels[xi] 
      })
    }
  }

  function handleSvgLeave() {
    setMouseX(null)
    setTooltip(null)
  }

  return (
    <div className={styles.chartPanel} style={{ minHeight: 400, paddingTop: 16 }}>
      {/* Dimension Switcher */}
      <div className="flex items-center gap-0 mb-4 mt-2">
        <span className="text-[0.78rem] text-muted-foreground mr-3 font-semibold">时间维度</span>
        <div className="flex bg-muted/60 rounded-lg p-[2px] gap-[2px]">
          {DIMS.map(d => {
            const isActive = activeDim === d.key
            return (
              <button
                key={d.key}
                onClick={() => setActiveDim(d.key)}
                className={`border-none cursor-pointer rounded-md px-3.5 py-1 text-[0.78rem] font-semibold transition-all duration-150 ${
                  isActive 
                    ? 'bg-background text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1)]' 
                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {d.label}
              </button>
            )
          })}
        </div>
        <span className="text-[0.72rem] text-muted-foreground/70 ml-3">{data.groupLabel}</span>
      </div>

      {/* Stream Chart SVG Container */}
      <div className="relative mt-2 w-full max-w-full overflow-hidden" style={{ aspectRatio: `${W}/${H}` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleSvgMove}
          onMouseLeave={handleSvgLeave}
          className="w-full h-full cursor-crosshair block"
        >
          <g transform={`translate(${PL},${PT})`}>
            {/* Grid lines */}
            {yScale.ticks(4).map(t => (
              <line key={`grid-${t}`}
                x1={0} x2={innerW}
                y1={yScale(t)} y2={yScale(t)}
                stroke="currentColor" strokeOpacity={0.05} strokeWidth={1}
              />
            ))}

            {/* Stream paths */}
            {series.map((s, ti) => {
              const tag = TAGS[ti]
              const isHov = tooltip && tooltip.tag.key === tag.key
              return (
                <path
                  key={tag.key}
                  d={area(s) || undefined}
                  fill={tag.color}
                  fillOpacity={isHov ? 0.92 : 0.72}
                  stroke={tag.color}
                  strokeWidth={isHov ? 1.5 : 0.5}
                  strokeOpacity={0.4}
                  style={{ transition: 'fill-opacity 0.15s, stroke-width 0.15s' }}
                />
              )
            })}

            {/* Hover vertical line */}
            {mouseX !== null && (
              <line
                x1={mouseX} x2={mouseX}
                y1={0} y2={innerH}
                stroke="currentColor" strokeWidth={1}
                strokeDasharray="3 3" strokeOpacity={0.35}
              />
            )}

            {/* X axis labels */}
            {data.labels.map((lbl: string, i: number) => {
              const show = data.n <= 12 ? true : data.n <= 24 ? i % 3 === 0 : i % 2 === 0
              if (!show) return null
              
              const anchor = i === 0 ? 'start' : i === data.n - 1 ? 'end' : 'middle'
              return (
                <text key={`xlbl-${i}`}
                  x={xScale(i)} y={innerH + 20}
                  textAnchor={anchor}
                  className="fill-muted-foreground font-semibold"
                  fontSize={8}
                >{lbl}</text>
              )
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div 
            className="absolute z-10 bg-[#1a1a1a] dark:bg-[#222] rounded-xl p-3 pointer-events-none shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
            style={{
              top: PT - 8,
              left: tooltip.leftPct,
              width: 140
            }}
          >
            <div className="text-[11px] text-[#888] mb-1">{tooltip.label}</div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: tooltip.tag.color }}></div>
              <span className="text-[13px] font-semibold text-white">{tooltip.tag.label}</span>
              <span className="text-[12px] text-[#aaa] ml-auto">{tooltip.value} 首</span>
            </div>
            
            <div className="mt-1.5 border-t border-white/10 pt-1.5 flex flex-col gap-[3px]">
              {TAGS.map((t, ti) => ({ ...t, val: data.raw[ti][tooltip.xi] }))
                .filter(t => t.val > 0)
                .sort((a, b) => b.val - a.val)
                .slice(0, 4)
                .map(t => (
                  <div key={t.key} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-[1px]" style={{ background: t.color }}></div>
                      <span className="text-[11px] text-[#aaa]">{t.label}</span>
                    </div>
                    <span className="text-[11px] text-[#666]">{t.val}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 px-1">
        {TAGS.map(t => (
          <div key={t.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-[3px] opacity-85" style={{ background: t.color }}></div>
            <span className="text-[0.72rem] text-muted-foreground font-medium">{t.label}</span>
          </div>
        ))}
      </div>
      
      {/* Footer Note */}
      <div className={`${styles.helperText} mt-4 pt-3.5 border-t border-border/40 flex justify-between items-center`}>
        <span>悬停查看各标签播放量 · 流宽度代表比例占比</span>
        <span>共 {TAGS.length} 个标签 · 近期数据</span>
      </div>
    </div>
  )
}
