'use client'

import { useEffect, useRef, useState } from 'react'

// ── Shared underline input style ──────────────────────────────────────────────

const baseUnderline: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid oklch(0.76 0.08 65 / 0.5)',
  borderRadius: 0,
  padding: '3px 0',
  outline: 'none',
  width: '100%',
  color: 'oklch(0.3 0.02 50)',
  fontSize: 12,
  fontFamily: 'inherit',
  transition: 'border-color 0.18s',
}

const focusUnderline: React.CSSProperties = {
  borderBottomColor: 'oklch(0.62 0.2 44)',
}

// ── EditableField ─────────────────────────────────────────────────────────────

interface EditableFieldProps {
  value: string | number | null | undefined
  onChange: (val: string) => void
  isEditing: boolean
  type?: 'text' | 'textarea' | 'number'
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export function EditableField({
  value,
  onChange,
  isEditing,
  type = 'text',
  placeholder = '—',
  className = '',
  style,
}: EditableFieldProps) {
  const [focused, setFocused] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Set initial textarea height on mount
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  if (!isEditing) {
    return (
      <span className={className} style={style}>
        {value ?? <span style={{ opacity: 0.4 }}>{placeholder}</span>}
      </span>
    )
  }

  const inputSty: React.CSSProperties = {
    ...baseUnderline,
    ...(focused ? focusUnderline : {}),
    ...style,
  }

  if (type === 'textarea') {
    return (
      <textarea
        ref={taRef}
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value)
          // Sync height to content
          e.target.style.height = 'auto'
          e.target.style.height = `${e.target.scrollHeight}px`
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={className}
        rows={2}
        style={{ ...inputSty, resize: 'none', minHeight: 44, overflow: 'hidden' }}
      />
    )
  }

  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className={className}
      style={inputSty}
    />
  )
}

// ── EditableTags ──────────────────────────────────────────────────────────────
// Real chip-based tag editor: each tag shows as a removable pill.
// Type + Enter or comma to add; Backspace on empty to remove last.

interface EditableTagsProps {
  tags: string[]
  onChange: (tags: string[]) => void
  isEditing: boolean
  style?: React.CSSProperties
}

export function EditableTags({ tags, onChange, isEditing, style }: EditableTagsProps) {
  const [inputVal, setInputVal] = useState('')
  const [focused, setFocused] = useState(false)

  if (!isEditing) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.length === 0 ? (
          <span style={{ opacity: 0.4, ...style }}>—</span>
        ) : (
          tags.map((t) => (
            <span
              key={t}
              className="text-[9px] px-1.5 py-0.5 rounded-full border"
              style={{ borderColor: 'oklch(0.65 0.18 35 / 0.35)', color: 'oklch(0.55 0.18 35)', ...style }}
            >
              {t}
            </span>
          ))
        )}
      </div>
    )
  }

  function commit(raw: string) {
    const t = raw.trim().replace(/,+$/, '')
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInputVal('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(inputVal)
    }
    if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        alignItems: 'center',
        borderBottom: `1.5px solid ${focused ? 'oklch(0.62 0.2 44)' : 'oklch(0.76 0.08 65 / 0.5)'}`,
        paddingBottom: 5,
        transition: 'border-color 0.18s',
        minHeight: 28,
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 10,
            padding: '2px 8px 2px 8px',
            borderRadius: 12,
            background: 'oklch(0.92 0.04 72)',
            border: '1px solid oklch(0.74 0.1 58 / 0.35)',
            color: 'oklch(0.38 0.1 50)',
            lineHeight: 1.4,
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'oklch(0.58 0.08 50)',
              fontSize: 13,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              marginLeft: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (inputVal.trim()) commit(inputVal) }}
        placeholder={tags.length === 0 ? '输入后按 Enter 添加' : '继续添加…'}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 10,
          color: 'oklch(0.3 0.02 50)',
          minWidth: 90,
          fontFamily: 'inherit',
          padding: '2px 0',
        }}
      />
    </div>
  )
}
