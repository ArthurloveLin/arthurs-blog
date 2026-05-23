import type { MemoHabitCurrentState } from '@/lib/memo-habits'

export function formatHabitTime(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function getHabitStatusLabel(state: MemoHabitCurrentState) {
  if (state.status === 'scheduled') {
    return `下次 ${formatHabitTime(state.dueAt)}`
  }

  if (state.status === 'pending') {
    return '待确认'
  }

  if (state.status === 'completed') {
    return '已完成'
  }

  if (state.status === 'missed') {
    return '已错过'
  }

  if (state.status === 'delayed') {
    return state.delayedTo ? `延后至 ${formatHabitTime(state.delayedTo)}` : '已延后'
  }

  return '状态未知'
}

export function getHabitStatusClassName(status: MemoHabitCurrentState['status']) {
  if (status === 'completed') {
    return 'border-green-300/70 bg-green-100/80 text-green-700'
  }
  if (status === 'pending') {
    return 'border-amber-300/70 bg-amber-100/80 text-amber-700'
  }
  if (status === 'missed') {
    return 'border-red-300/70 bg-red-100/80 text-red-700'
  }
  if (status === 'delayed') {
    return 'border-blue-300/70 bg-blue-100/80 text-blue-700'
  }
  return 'border-slate-300/70 bg-slate-100/80 text-slate-600'
}

export function getHabitStreakLabel(streak: number) {
  return streak > 0 ? `连续 ${streak} 次` : null
}

export const HABIT_DELAY_PRESETS = [
  { label: '15 分钟', minutes: 15 },
  { label: '1 小时', minutes: 60 },
  { label: '明天同一时间', minutes: 24 * 60 },
] as const