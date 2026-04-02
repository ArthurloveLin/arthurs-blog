'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PresenceState {
  user: string
  activity: string
  lastActive: number
}

interface ActivityBannerProps {
  sessionId: string
}

export default function ActivityBanner({ sessionId }: ActivityBannerProps) {
  const [presenceList, setPresenceList] = useState<PresenceState[]>([])
  const [author, setAuthor] = useState<string>('')
  
  useEffect(() => {
    // 1. 获取初始身份
    const getAuthor = () => localStorage.getItem('wardrobe_author') || '访客'
    setAuthor(getAuthor())

    // 2. 监听身份变化 (跨组件/跨标签页)
    const handleStorage = () => setAuthor(getAuthor())
    window.addEventListener('storage', handleStorage)
    window.addEventListener('wardrobe_author_changed', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('wardrobe_author_changed', handleStorage)
    }
  }, [])

  useEffect(() => {
    if (!author) return

    const channel = supabase.channel(`presence:${sessionId}`, {
      config: { presence: { key: author } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const list: PresenceState[] = []
        Object.keys(state).forEach((key) => {
          const presences = state[key] as unknown as PresenceState[]
          presences.forEach((p) => {
            list.push({
              user: key,
              activity: p.activity || '正在浏览',
              lastActive: p.lastActive || Date.now(),
            })
          })
        })
        console.log('Presence Sync:', list)
        setPresenceList(list)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ activity: '正在浏览', lastActive: Date.now() })
        }
      })

    const handleActivityUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ activity: string }>
      channel.track({ activity: customEvent.detail.activity, lastActive: Date.now() })
    }

    window.addEventListener('update_presence_activity', handleActivityUpdate)

    return () => {
      window.removeEventListener('update_presence_activity', handleActivityUpdate)
      supabase.removeChannel(channel)
    }
  }, [sessionId, author])

  // 过滤出“其他人”的活动，或者“自己但在其他设备”的活动
  const otherActivities = presenceList
    .filter(p => p.activity !== '正在浏览' && p.activity !== '')
    // 如果想要测试，暂时注释掉下面这行过滤，就能看到自己的动作
    .map(p => `${p.user}${p.activity}`)

  const onlineUsers = Array.from(new Set(presenceList.map(p => p.user)))

  // 如果没有任何人在线（这不科学，至少有自己），或者只有自己一个 Session
  if (presenceList.length <= 1) return null

  // 渲染逻辑
  const isMultiUser = onlineUsers.length > 1
  const activeAlerts = otherActivities.length > 0

  if (!activeAlerts) {
    return (
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-1.5 sticky top-0 z-50 overflow-hidden shadow-sm transition-all duration-500">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
          <div className="flex -space-x-1.5">
            {onlineUsers.map((u, i) => (
              <div key={i} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${u === 'Arthur' ? 'bg-pink-400' : u === 'Grace' ? 'bg-blue-400' : 'bg-gray-400'}`}>
                {u[0]}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <p className="text-[11px] font-bold text-gray-500 tracking-wide uppercase">
              {isMultiUser ? `${onlineUsers.join(' & ')} 正在协同` : '协作模式已激活'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-pink-500 px-4 py-2 sticky top-0 z-50 overflow-hidden shadow-lg shadow-pink-500/30 transition-all duration-300">
      <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
        <span className="text-white text-xs animate-pulse">⚡️</span>
        <div className="relative h-5 flex-1 flex flex-col items-center justify-center">
          {otherActivities.slice(0, 1).map((text, i) => (
            <p key={i} className="text-xs font-black text-white uppercase tracking-widest animate-in slide-in-from-bottom-2 duration-300">
              {text}
            </p>
          ))}
        </div>
        <span className="text-white text-xs animate-pulse">⚡️</span>
      </div>
    </div>
  )
}

// Utility to trigger activity update
export function updatePresenceActivity(activity: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('update_presence_activity', { detail: { activity } }))
  }
}
