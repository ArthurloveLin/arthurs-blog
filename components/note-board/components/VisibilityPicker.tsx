'use client'

import { Globe, Lock } from 'lucide-react'
import type { NoteVisibility } from '@/lib/note-boards'

interface VisibilityPickerProps {
  value: NoteVisibility
  onChange: (value: NoteVisibility) => void
}

export function VisibilityPicker({ value, onChange }: VisibilityPickerProps) {
  const isPrivate = value === 'admin_only'

  return (
    <button
      type="button"
      title={isPrivate ? '仅管理员可见（点击切换为公开）' : '所有人可见（点击切换为仅管理员）'}
      onClick={() => onChange(isPrivate ? 'public' : 'admin_only')}
      className={[
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all',
        isPrivate
          ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100'
          : 'border-black/10 bg-white/70 text-slate-500 hover:bg-white hover:text-slate-900',
      ].join(' ')}
    >
      {isPrivate
        ? <Lock size={13} strokeWidth={1.8} />
        : <Globe size={13} strokeWidth={1.8} />}
    </button>
  )
}
