'use client'

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
  if (!isEditing) {
    return (
      <span className={className} style={style}>
        {value ?? <span style={{ opacity: 0.4 }}>{placeholder}</span>}
      </span>
    )
  }

  const inputStyle: React.CSSProperties = {
    background: 'oklch(0.95 0.02 85)',
    border: '1px solid oklch(0.65 0.18 35 / 0.5)',
    borderRadius: 3,
    padding: '1px 4px',
    outline: 'none',
    width: '100%',
    color: 'oklch(0.3 0.02 50)',
    ...style,
  }

  if (type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        style={{ ...inputStyle, minHeight: 48, resize: 'vertical' }}
        rows={2}
      />
    )
  }

  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={inputStyle}
    />
  )
}

interface EditableTagsProps {
  tags: string[]
  onChange: (tags: string[]) => void
  isEditing: boolean
  style?: React.CSSProperties
}

export function EditableTags({ tags, onChange, isEditing, style }: EditableTagsProps) {
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

  return (
    <input
      type="text"
      value={tags.join(', ')}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      }
      placeholder="用逗号分隔多个标签"
      style={{
        background: 'oklch(0.95 0.02 85)',
        border: '1px solid oklch(0.65 0.18 35 / 0.5)',
        borderRadius: 3,
        padding: '1px 4px',
        width: '100%',
        color: 'oklch(0.3 0.02 50)',
        fontSize: 10,
      }}
    />
  )
}
