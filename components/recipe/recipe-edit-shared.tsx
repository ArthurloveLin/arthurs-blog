'use client'

export const pageStyle = { color: 'oklch(0.3 0.02 50)' }
export const mutedStyle = { color: 'oklch(0.55 0.03 50)' }

export const inputStyle: React.CSSProperties = {
  background: 'oklch(0.95 0.02 85)',
  border: '1px solid oklch(0.65 0.18 35 / 0.5)',
  borderRadius: 4,
  padding: '2px 6px',
  outline: 'none',
  color: 'oklch(0.3 0.02 50)',
  fontSize: 12,
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono tracking-widest uppercase mb-1.5" style={{ color: 'oklch(0.55 0.03 50)', fontSize: 11, fontFamily: 'monospace' }}>
      {children}
    </p>
  )
}
