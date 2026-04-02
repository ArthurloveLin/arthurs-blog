'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient, RealtimeChannel } from '@supabase/supabase-js'

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
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const author = localStorage.getItem('wardrobe_author') || '访客'
    
    const channel = supabase.channel(`presence:${sessionId}`, {
      config: {
        presence: {
          key: author,
        },
      },
    })

    channelRef.current = channel

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
        
        setPresenceList(list)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            activity: '正在浏览',
            lastActive: Date.now(),
          })
        }
      })

    // Listen for custom activity events from other components
    const handleActivityUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ activity: string }>
      const { activity } = customEvent.detail
      channel.track({
        activity,
        lastActive: Date.now(),
      })
    }

    window.addEventListener('update_presence_activity', handleActivityUpdate)

    return () => {
      window.removeEventListener('update_presence_activity', handleActivityUpdate)
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Get other users' activities
  const otherActivities = presenceList
    .filter(p => p.activity !== '正在浏览' && p.activity !== '' && p.user !== (localStorage.getItem('wardrobe_author') || '访客'))
    .map(p => `${p.user}${p.activity}`)

  if (otherActivities.length === 0) {
    const onlineUsers = Array.from(new Set(presenceList.map(p => p.user)))
    if (onlineUsers.length <= 1) return null

    return (
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-1 sticky top-0 z-50 overflow-hidden shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-1 duration-500">
          <div className="flex -space-x-1">
            {onlineUsers.map(u => (
              <div key={u} className="w-5 h-5 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[8px] font-bold text-blue-600">
                {u[0]}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
            <p className="text-[10px] font-semibold text-gray-500 tracking-tight">
              {onlineUsers.join(' & ')} 正在一起挑选
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-pink-500 px-4 py-1.5 sticky top-0 z-50 overflow-hidden shadow-lg shadow-pink-500/20">
      <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-300">
          <span className="text-white text-sm animate-pulse">✨</span>
          <div className="flex flex-col items-center overflow-hidden h-4">
            <div className="animate-bounce">
              {otherActivities.map((text, i) => (
                <p key={i} className="text-[11px] font-black text-white uppercase tracking-wider">
                  {text}
                </p>
              ))}
            </div>
          </div>
          <span className="text-white text-sm animate-pulse">✨</span>
        </div>
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
