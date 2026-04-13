'use client'

import { Bold, Check, Highlighter, Italic, ListTodo, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import EditorActionBar from '@/components/EditorActionBar'
import type { TextEditResult, TextSelectionRange } from '@/components/note-board/types'
import { clamp } from '@/components/note-board/utils/board'
import { insertChecklistSyntax, wrapSelectionWithSyntax } from '@/components/note-board/utils/editor'

export interface NoteEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  saveLabel: string
  isSaving: boolean
  onSave: () => void
  onCancel?: () => void
  saveDisabled?: boolean
  maxLength?: number
  minHeightClassName?: string
  shellClassName?: string
  toolbarClassName?: string
  autoFocus?: boolean
  buttonSize?: 'sm' | 'md'
}

function ToolbarIconButton({
  onClick,
  label,
  children,
  disabled = false,
  emphasize = false,
  size = 'md',
}: {
  onClick: () => void
  label: string
  children: ReactNode
  disabled?: boolean
  emphasize?: boolean
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full border transition ${emphasize ? 'border-slate-900 bg-slate-900 text-white hover:opacity-90 disabled:border-slate-400 disabled:bg-slate-400' : 'border-black/10 bg-white/70 text-slate-700 hover:bg-white disabled:opacity-40'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function NoteEditor({
  value,
  onChange,
  placeholder,
  saveLabel,
  isSaving,
  onSave,
  onCancel,
  saveDisabled = false,
  maxLength,
  minHeightClassName = 'min-h-[108px]',
  shellClassName = 'overflow-hidden rounded-[18px] border border-black/10 bg-white/45',
  toolbarClassName = 'px-3 py-2 text-[11px] text-slate-700',
  autoFocus = false,
  buttonSize = 'md',
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<TextSelectionRange | null>(null)

  useEffect(() => {
    if (!pendingSelectionRef.current || !textareaRef.current) return

    const nextSelection = pendingSelectionRef.current
    pendingSelectionRef.current = null
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(nextSelection.start, nextSelection.end)
  }, [value])

  useEffect(() => {
    if (!autoFocus || !textareaRef.current) return

    textareaRef.current.focus()
    const caret = textareaRef.current.value.length
    textareaRef.current.setSelectionRange(caret, caret)
  }, [autoFocus])

  function commitTextEdit(result: TextEditResult) {
    const nextValue = typeof maxLength === 'number' ? result.value.slice(0, maxLength) : result.value
    const nextSelection = {
      start: clamp(result.selection.start, 0, nextValue.length),
      end: clamp(result.selection.end, 0, nextValue.length),
    }

    pendingSelectionRef.current = nextSelection
    onChange(nextValue)
  }

  function withSelection(transform: (text: string, start: number, end: number) => TextEditResult) {
    const textarea = textareaRef.current
    if (!textarea) return
    commitTextEdit(transform(value, textarea.selectionStart, textarea.selectionEnd))
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`${minHeightClassName} w-full resize-none rounded-[18px] border border-black/10 bg-white/55 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-500/70 focus:border-black/20 focus:ring-2 focus:ring-black/10`}
      />
      <div className={shellClassName}>
        <EditorActionBar
          noWrap
          className={['border-t-0', toolbarClassName].join(' ')}
          leading={(
            <>
              <ToolbarIconButton size={buttonSize} onClick={() => withSelection(insertChecklistSyntax)} label="插入 checklist">
                <ListTodo size={buttonSize === 'sm' ? 10 : 12} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton size={buttonSize} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '**'))} label="加粗">
                <Bold size={buttonSize === 'sm' ? 10 : 12} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton size={buttonSize} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '*'))} label="斜体">
                <Italic size={buttonSize === 'sm' ? 10 : 12} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton size={buttonSize} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '=='))} label="高亮">
                <Highlighter size={buttonSize === 'sm' ? 10 : 12} strokeWidth={1.8} />
              </ToolbarIconButton>
            </>
          )}
          trailing={(
            <>
              {onCancel ? (
                <ToolbarIconButton size={buttonSize} onClick={onCancel} label="取消编辑">
                  <X size={buttonSize === 'sm' ? 10 : 12} strokeWidth={1.8} />
                </ToolbarIconButton>
              ) : null}
              <ToolbarIconButton size={buttonSize} onClick={onSave} label={isSaving ? '保存中' : saveLabel} disabled={isSaving || saveDisabled} emphasize>
                <Check size={buttonSize === 'sm' ? 10 : 12} strokeWidth={2} />
              </ToolbarIconButton>
            </>
          )}
        />
      </div>
    </div>
  )
}