'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CalendarClock, Clock3, Heart, Library, Music2, Radio, Monitor, Smartphone, Speaker, Laptop, type LucideIcon } from 'lucide-react'

import { useSpotify } from '@/components/SpotifyProvider'
import { spotifyImg } from '@/lib/spotify-img'
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

function getDeviceLabel(deviceName?: string, deviceType?: string) {
  if (!deviceName && !deviceType) {
    return '最近设备未知'
  }

  if (deviceType === 'Computer') return '电脑端'
  if (deviceType === 'Smartphone') return '手机端'
  if (deviceType === 'Speaker') return '音箱端'
  return deviceName || deviceType || 'Spotify 设备'
}

function DeviceInfoIcon({ deviceType }: { deviceType?: string }) {
  if (deviceType === 'Computer') {
    return <Laptop className="h-4 w-4 shrink-0" strokeWidth={1.8} />
  }

  if (deviceType === 'Smartphone') {
    return <Smartphone className="h-4 w-4 shrink-0" strokeWidth={1.8} />
  }

  if (deviceType === 'Speaker') {
    return <Speaker className="h-4 w-4 shrink-0" strokeWidth={1.8} />
  }

  return <Monitor className="h-4 w-4 shrink-0" strokeWidth={1.8} />
}

function StatItem({ label, value, icon: Icon, href }: { label: string; value: number; icon: LucideIcon; href?: string }) {
  const content = (
    <div className="group flex flex-col items-center justify-center gap-1.5 lg:items-end lg:gap-0.5">
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

type SpotifyWidePlayerData = NonNullable<ReturnType<typeof useSpotify>['state']['data']>

export default function SpotifyWidePlayer({ stats }: { stats?: SpotifyWidePlayerStats }) {
  const {
    state: { data, loading },
  } = useSpotify()

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

  const playerKey = [
    data.songUrl ?? data.title ?? 'track',
    data.artist ?? 'artist',
    data.isPlaying ? 'playing' : data.playedAt ?? 'paused',
  ].join('::')

  return <SpotifyWidePlayerContent key={playerKey} data={data} stats={stats} />
}

function SpotifyWidePlayerContent({
  data,
  stats,
}: {
  data: SpotifyWidePlayerData
  stats?: SpotifyWidePlayerStats
}) {
  const [localProgress, setLocalProgress] = useState(() => data.progressMs ?? 0)

  useEffect(() => {
    let animationFrameId: number
    const initialProgress = data.progressMs ?? 0

    if (!data.isPlaying || !data.durationMs) {
      animationFrameId = requestAnimationFrame(() => setLocalProgress(initialProgress))
      return () => cancelAnimationFrame(animationFrameId)
    }

    const startTime = Date.now()
    const duration = data.durationMs

    const update = () => {
      const elapsed = Date.now() - startTime
      const nextProgress = initialProgress + elapsed

      if (nextProgress <= duration) {
        setLocalProgress(nextProgress)
        animationFrameId = requestAnimationFrame(update)
      } else {
        setLocalProgress(duration)
      }
    }

    animationFrameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrameId)
  }, [data.progressMs, data.isPlaying, data.durationMs])


  const statusLabel = data.isPlaying ? '正在播放' : data.playedAt ? formatRelativeTime(data.playedAt) : '最近播放'
  const absolutePlayedAt = data.playedAt ? formatAbsoluteTime(data.playedAt) : null

  const progressPercent = data.durationMs ? (localProgress / data.durationMs) * 100 : 0

  return (
    <div className="relative flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.1),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.8),rgba(240,253,248,0.7))] p-5 sm:p-7 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),linear-gradient(135deg,rgba(10,20,15,0.7),rgba(5,15,10,0.7))] shadow-[0_15px_40px_rgba(16,185,129,0.22),0_4px_16px_rgba(16,185,129,0.12)]">
      {data.albumImageUrl && (
        <div className="animate-in fade-in mix-blend-multiply transition-opacity duration-1000 dark:mix-blend-screen pointer-events-none absolute inset-0 overflow-hidden opacity-30 dark:opacity-20 transform-gpu">
          <Image
            src={spotifyImg(data.albumImageUrl)!}
            alt=""
            fill
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="scale-125 saturate-150 object-cover"
            unoptimized
          />
          <div className="absolute inset-0 backdrop-blur-[80px] transform-gpu" />
        </div>
      )}

      <div className="hidden lg:block pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(120deg,transparent,rgba(16,185,129,0.05),transparent)] opacity-60" />

      <div className="relative z-10">


        <div className="grid gap-8 lg:grid-cols-[auto_1fr_180px] lg:items-stretch xl:gap-12">
          {/* Column 1: Album Cover */}
          <div className="flex shrink-0 items-center justify-center">
            <div className="group relative h-40 w-40 overflow-hidden rounded-[24px] border border-white/50 bg-emerald-950/10 shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:h-56 sm:w-56 lg:h-64 lg:w-64 sm:rounded-[36px]">
              {data.albumImageUrl ? (
                <>
                  <Image
                    src={spotifyImg(data.albumImageUrl)!}
                    alt={data.album || data.title || 'Spotify artwork'}
                    fill
                    sizes="(max-width: 640px) 160px, (max-width: 1024px) 224px, 256px"
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
          </div>

          {/* Column 2: Info & Progress Grouped */}
          <div className="flex min-w-0 flex-col justify-between py-2">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-center lg:justify-start gap-3 opacity-70">
                <div className="h-[1px] w-8 bg-emerald-500/60" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-300 truncate">
                  {data.album}
                </span>
              </div>
              
              <h2 className="text-3xl font-black tracking-tighter text-foreground text-center lg:text-left sm:text-5xl lg:text-6xl xl:text-7xl leading-[0.95] py-2 [text-wrap:balance]">
                {data.title}
              </h2>
              
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 mt-4">
                <p className="text-lg font-medium text-foreground/70 sm:text-xl lg:text-2xl leading-none">
                  by <span className="text-foreground border-b-2 border-emerald-500/20 pb-0.5">{data.artist}</span>
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest leading-none">
                  {data.isPlaying ? (
                    <>
                      <span className="h-1 w-1 rounded-full bg-emerald-500/40 opacity-50" />
                      <span className="inline-flex items-center gap-1.5 opacity-50">
                        <DeviceInfoIcon deviceType={data.deviceType} />
                        {getDeviceLabel(data.deviceName, data.deviceType)}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-emerald-500/40 opacity-50" />
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-white/60 px-2 py-0.5 sm:px-3 sm:py-1 font-mono dark:bg-white/5 text-emerald-700/80 dark:text-emerald-300/80">
                        <span className="heartbeat text-[10px] leading-none">❤️</span>
                        {statusLabel}
                      </span>
                    </>
                  ) : absolutePlayedAt ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 opacity-50">
                        <Clock3 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {absolutePlayedAt}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-emerald-500/40 opacity-50" />
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-white/60 px-2 py-0.5 sm:px-3 sm:py-1 font-mono dark:bg-white/5 text-emerald-700/80 dark:text-emerald-300/80">
                        <Radio className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {statusLabel}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {data.isPlaying && data.durationMs && (
                <>
                  <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-emerald-500/10 dark:bg-white/5">
                    <div 
                      className="absolute inset-y-0 left-0 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      style={{ width: `${progressPercent}%` }}
                    />

                  </div>
                  <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest opacity-50">
                    <span>{formatMs(localProgress)}</span>
                    <span>{formatMs(data.durationMs)}</span>
                  </div>
                </>
              )}
            </div>

          </div>


          {/* Stats Column */}
          <div className="mt-4 flex flex-row flex-wrap justify-center gap-6 border-emerald-500/10 sm:gap-8 lg:mt-0 lg:flex-col lg:items-end lg:border-l lg:pl-8">
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