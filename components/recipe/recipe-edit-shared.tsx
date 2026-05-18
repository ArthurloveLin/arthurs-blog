'use client'

import { useState } from 'react'

export const pageStyle = { color: 'oklch(0.3 0.02 50)' }
export const mutedStyle = { color: 'oklch(0.55 0.03 50)' }

// Underline-style for bare <input> elements used in ingredient/step rows
export const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid oklch(0.76 0.08 65 / 0.5)',
  borderRadius: 0,
  padding: '3px 0',
  outline: 'none',
  color: 'oklch(0.3 0.02 50)',
  fontSize: 12,
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: 'oklch(0.62 0.06 58)',
        fontSize: 9,
        fontFamily: 'ui-monospace, monospace',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {children}
    </p>
  )
}

// ── StarRating ────────────────────────────────────────────────────────────────
// Click same star again to clear (toggle back to null).

interface StarRatingProps {
  value: number | null | undefined
  onChange: (v: number | null) => void
  max?: number
  size?: number
}

export function StarRating({ value, onChange, max = 5, size = 16 }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const active = hovered ?? value ?? 0

  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(star === value ? null : star)}
          style={{
            fontSize: size,
            color: star <= active ? 'oklch(0.68 0.18 52)' : 'oklch(0.82 0.06 65)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            transition: 'color 0.12s, transform 0.1s',
            transform: star <= active ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ── DotRating ─────────────────────────────────────────────────────────────────
// 5-dot visual tap rating for flavor dimensions (0–5; click same dot = clear).

interface DotRatingProps {
  label: string
  value: number | null | undefined
  onChange: (v: number | null) => void
}

export function DotRating({ label, value, onChange }: DotRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const active = hovered ?? value ?? 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 12,
          color: 'oklch(0.42 0.06 50)',
          width: 18,
          textAlign: 'center',
          flexShrink: 0,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 5 }}>
        {[1, 2, 3, 4, 5].map((dot) => (
          <button
            key={dot}
            type="button"
            onMouseEnter={() => setHovered(dot)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(dot === value ? null : dot)}
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: dot <= active
                ? 'oklch(0.65 0.18 45)'
                : 'oklch(0.82 0.06 65 / 0.55)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'background 0.12s, transform 0.1s',
              transform: dot === (hovered ?? value) ? 'scale(1.3)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
