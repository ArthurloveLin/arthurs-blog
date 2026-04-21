'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock3, Headphones, Music2, Radio, Sparkles } from 'lucide-react'

import { useSpotify } from '@/components/SpotifyProvider'
import AdminOnly from '@/components/AdminOnly'
import SpotifySyncButton from './SpotifySyncButton'
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

function getDeviceLabel(deviceName?: string, deviceType?: string) {
  if (!deviceName && !deviceType) {
    return '最近设备未知'
  }

  if (deviceType === 'Computer') return '电脑端'
  if (deviceType === 'Smartphone') return '手机端'
  if (deviceType === 'Speaker') return '音箱端'
  return deviceName || deviceType || 'Spotify 设备'
}

export default function SpotifyWidePlayer() {
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

  const recentTracks = data.recentTracks ?? []
  const statusLabel = data.isPlaying ? '正在播放' : data.playedAt ? formatRelativeTime(data.playedAt) : '最近播放'
  const absolutePlayedAt = data.playedAt ? formatAbsoluteTime(data.playedAt) : null

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] p-6 shadow-[0_24px_90px_rgba(16,185,129,0.16)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_30%),linear-gradient(135deg,rgba(3,10,8,0.95),rgba(8,24,17,0.95))]">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(120deg,transparent,rgba(16,185,129,0.12),transparent)] opacity-80" />

      <div className="relative z-10 grid gap-6 lg:grid-cols-[112px_minmax(0,1fr)_240px] lg:items-center">
        <div className="relative h-28 w-28 overflow-hidden rounded-[28px] border border-white/50 bg-emerald-950/10 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          {data.albumImageUrl ? (
            <Image
              src={data.albumImageUrl}
              alt={data.album || data.title || 'Spotify artwork'}
              fill
              sizes="112px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-emerald-700 dark:text-emerald-300">
              <Music2 className="h-10 w-10" strokeWidth={1.8} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-white/60 px-3 py-1 font-mono dark:bg-white/5">
              <Radio className="h-3.5 w-3.5" strokeWidth={1.8} />
              {statusLabel}
            </span>
            {data.bpm ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/15 px-3 py-1">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
                {Math.round(data.bpm)} BPM
              </span>
            ) : null}
          </div>

          <h2 className="mt-4 truncate text-3xl font-semibold tracking-tight text-foreground sm:text-[2.6rem]">
            {data.title}
          </h2>
          <p className="mt-2 truncate text-base text-foreground/80 sm:text-lg">{data.artist}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-4 w-4" strokeWidth={1.8} />
              {data.album}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" strokeWidth={1.8} />
              {absolutePlayedAt ? `绝对时间 ${absolutePlayedAt}` : '实时播放中'}
            </span>
            <span>{getDeviceLabel(data.deviceName, data.deviceType)}</span>
          </div>
        </div>

        <div className="space-y-3 lg:justify-self-end">
          <AdminOnly>
            <SpotifySyncButton />
          </AdminOnly>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <a
              href="#recently-played"
              className="rounded-[22px] border border-border/60 bg-background/70 px-4 py-3 text-sm font-medium text-foreground transition hover:border-emerald-500/35 hover:text-emerald-600"
            >
              查看 Recently Played
            </a>
            <Link
              href="/spotify#library"
              className="rounded-[22px] border border-border/60 bg-background/70 px-4 py-3 text-sm font-medium text-foreground transition hover:border-emerald-500/35 hover:text-emerald-600"
            >
              跳到曲库概览
            </Link>
          </div>
        </div>
      </div>

      {recentTracks.length > 0 ? (
        <div className="relative z-10 mt-6 border-t border-emerald-500/10 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Recent Tail</p>
            <span className="text-xs text-muted-foreground">顶部卡片保持未展开形态，只预览后续轨迹</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {recentTracks.slice(0, 3).map((track, index) => (
              <a
                key={`${track.id}-${track.playedAt}-${index}`}
                href={track.songUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-[20px] border border-white/40 bg-white/60 p-3 transition hover:border-emerald-500/30 hover:bg-white dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-muted">
                  {track.albumImageUrl ? (
                    <Image
                      src={track.albumImageUrl}
                      alt={track.album}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Music2 className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-emerald-600">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}