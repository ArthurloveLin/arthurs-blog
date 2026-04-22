'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CalendarClock, Clock3, Headphones, Heart, Library, Music2, Radio, Sparkles, Monitor, Smartphone, Speaker, Laptop } from 'lucide-react'

import { useSpotify } from '@/components/SpotifyProvider'
import { formatStableDate } from '@/lib/date-format'

function formatRelativeTime(playedAt: string) {
  const date = new Date(playedAt)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return '刚刚播放'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分钟前`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小时前`
  return `${Math.floor(diffInSeconds / 86400)} 天前`
}

function formatAbsoluteTime(playedAt: string) {
  return formatStableDate(playedAt, {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatMs(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getDeviceIcon(deviceType?: string) {
  if (deviceType === 'Computer') return Laptop
  if (deviceType === 'Smartphone') return Smartphone
  if (deviceType === 'Speaker') return Speaker
  return Monitor
}

function getDeviceLabel(deviceName?: string, deviceType?: string) {
  if (!deviceName && !deviceType) {
    return '最近设备未知'
  }

  if (deviceType === 'Computer') return '电脑端'
  if (deviceType === 'Smartphone') return '手机端'
  if (deviceType === 'Speaker') return '音箱端'
  return deviceName || deviceType || 'Spotify 设备'
}

function StatItem({ label, value, icon: Icon, href }: { label: string; value: number; icon: any; href?: string }) {
  const content = (
    <div className="group flex items-center justify-between gap-3 lg:flex-col lg:items-end lg:gap-0.5">
      <div className="flex items-center gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
        <Icon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-800 dark:text-emerald-200 whitespace-nowrap">{label}</p>
      </div>
      <p className="text-lg font-semibold tabular-nums text-foreground/90 transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400 sm:text-xl lg:text-lg">
        {value.toLocaleString()}
      </p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block transition-transform hover:-translate-x-0.5 active:scale-95">
        {content}
      </Link>
    )
  }

  return content
}

export interface SpotifyWidePlayerStats {
  recentlyPlayed: number
  likedSongs: number
  playlists: number
}

export default function SpotifyWidePlayer({ stats }: { stats?: SpotifyWidePlayerStats }) {
  const {
    state: { data, loading },
  } = useSpotify()

  const [localProgress, setLocalProgress] = useState(0)

  useEffect(() => {
    if (data?.progressMs) {
      setLocalProgress(data.progressMs)
    }
  }, [data?.progressMs])

  useEffect(() => {
    if (!data?.isPlaying || !data?.durationMs) return

    const interval = setInterval(() => {
      setLocalProgress((prev) => {
        const next = prev + 1000
        return next > (data.durationMs || 0) ? (data.durationMs || 0) : next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [data?.isPlaying, data?.durationMs])

  if (loading) {
    return (
      <div className="rounded-[28px] border border-emerald-500/15 bg-card/85 p-6 shadow-[0_20px_80px_rgba(16,185,129,0.10)] backdrop-blur-sm">
        <div className="grid gap-5 lg:grid-cols-[96px_1fr_220px] lg:items-center">
          <div className="h-24 w-24 animate-pulse rounded-[24px] bg-muted" />
          <div className="space-y-3">
            <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-7 w-3/4 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="hidden h-24 animate-pulse rounded-[24px] bg-muted lg:block" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-muted text-muted-foreground">
              <Music2 className="h-8 w-8" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Spotify Player</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">当前没有可展示的播放状态</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                dashboard 已就绪；下一次刷新到有效播放数据后，这里会展示宽版播放器头图和最近播放预览。
              </p>
            </div>
          </div>
          <a
            href="#recently-played"
            className="inline-flex items-center gap-2 self-start rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-emerald-500/40 hover:text-emerald-600"
          >
            查看最近播放
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </a>
        </div>
      </div>
    )
  }

  const statusLabel = data.isPlaying ? '正在播放' : data.playedAt ? formatRelativeTime(data.playedAt) : '最近播放'
  const absolutePlayedAt = data.playedAt ? formatAbsoluteTime(data.playedAt) : null
  const DeviceIcon = getDeviceIcon(data.deviceType)

  const progressPercent = data.durationMs ? (localProgress / data.durationMs) * 100 : 0

  return (
    <div className="relative flex min-h-[360px] flex-col justify-center overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.1),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.8),rgba(240,253,248,0.7))] p-6 sm:p-8 shadow-[0_18px_60_rgba(0,0,0,0.05)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),linear-gradient(135deg,rgba(10,20,15,0.7),rgba(5,15,10,0.7))]">
      {data.albumImageUrl && (
        <div className="animate-in fade-in mix-blend-multiply transition-opacity duration-1000 dark:mix-blend-screen pointer-events-none absolute inset-0 overflow-hidden opacity-30 dark:opacity-20">
          <Image
            src={data.albumImageUrl}
            alt=""
            fill
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="scale-125 saturate-150 object-cover blur-[80px]"
            unoptimized
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(120deg,transparent,rgba(16,185,129,0.05),transparent)] opacity-60" />

      <div className="relative z-10">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] text-emerald-700/80 sm:text-[11px] dark:text-emerald-300/80">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-white/60 px-2 py-0.5 font-mono sm:px-3 sm:py-1 dark:bg-white/5">
            {data.isPlaying ? (
              <span className="heartbeat text-[10px] leading-none">❤️</span>
            ) : (
              <Radio className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
            {statusLabel}
          </span>
          {data.bpm ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/15 px-2 py-0.5 font-mono sm:px-3 sm:py-1">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              {Math.round(data.bpm)} BPM
            </span>
          ) : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-[440px_1fr_160px] lg:items-stretch xl:grid-cols-[500px_1fr_180px]">
          {/* Column 1: Album Cover & Info Grouped */}
          <div className="flex min-w-0 items-center gap-6 md:gap-10">
            <div className="group relative h-32 w-32 shrink-0 overflow-hidden rounded-[24px] border border-white/50 bg-emerald-950/10 shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:h-44 sm:w-44 sm:rounded-[36px]">
              {data.albumImageUrl ? (
                <>
                  <Image
                    src={data.albumImageUrl}
                    alt={data.album || data.title || 'Spotify artwork'}
                    fill
                    sizes="160px"
                    className="transition-transform duration-700 ease-out object-cover group-hover:scale-105"
                    unoptimized
                  />
                  <div className="ring-1 ring-inset ring-white/20 pointer-events-none absolute inset-0 rounded-[36px]" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-emerald-700 dark:text-emerald-300">
                  <Music2 className="h-12 w-12" strokeWidth={1.8} />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-col justify-center gap-2">
              <div className="min-w-0 space-y-1">
                <div className="relative h-9 sm:h-12 lg:h-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
                  <div className="flex w-max animate-[marquee-scroll_20s_linear_infinite] hover:[animation-play-state:paused]">
                    <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl px-4">
                      {data.title}
                    </h2>
                    <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl px-4">
                      {data.title}
                    </h2>
                  </div>
                </div>
                <p className="text-base font-medium text-foreground/80 sm:text-lg lg:text-xl truncate">
                  {data.artist}
                </p>
              </div>
              <div className="mt-2 flex flex-col gap-y-1 text-[12px] font-medium text-foreground/70 sm:text-sm opacity-80">
                <span className="inline-flex items-center gap-2">
                  <Headphones className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{data.album}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <DeviceIcon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  {getDeviceLabel(data.deviceName, data.deviceType)}
                </span>
                {absolutePlayedAt && !data.isPlaying && (
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    {absolutePlayedAt}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar Column - Centered */}
          <div className="flex flex-col justify-center items-center px-4">
            {data.isPlaying && data.durationMs && (
              <div className="w-full max-w-[320px] space-y-4 text-center">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-emerald-500/10 dark:bg-white/5">
                  <div 
                    className="absolute inset-y-0 left-0 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-[width] duration-300 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between font-mono text-[12px] tracking-wider text-muted-foreground/70">
                  <span>{formatMs(localProgress)}</span>
                  <span>{formatMs(data.durationMs)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Stats Column */}
          <div className="flex flex-col gap-5 border-emerald-500/10 lg:items-end lg:border-l lg:pl-8">
            {stats && (
              <>
                <StatItem label="Recently Played" value={stats.recentlyPlayed} icon={CalendarClock} href="#recently-played" />
                <StatItem label="Liked Songs" value={stats.likedSongs} icon={Heart} href="#saved-tracks" />
                <StatItem label="Playlists" value={stats.playlists} icon={Library} href="#playlists" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}