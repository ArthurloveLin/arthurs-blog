'use client'

import { Bold, Check, Highlighter, Italic, ListTodo, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import EmojiPickerButton from '@/components/emoji/EmojiPickerButton'
import EditorActionBar from '@/components/EditorActionBar'
import type { TextEditResult, TextSelectionRange } from '@/components/note-board/types'
import { clamp } from '@/components/note-board/utils/board'
import { insertTextAtSelection } from '@/lib/text-selection'
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
  toolbarLeadingAddon?: ReactNode
  toolbarButtonVariant?: 'filled' | 'bare'
  emojiTriggerVariant?: 'filled' | 'bare'
  showCancelButton?: boolean
}

function ToolbarIconButton({
  onClick,
  label,
  children,
  disabled = false,
  emphasize = false,
  size = 'md',
  variant = 'filled',
}: {
  onClick: () => void
  label: string
  children: ReactNode
  disabled?: boolean
  emphasize?: boolean
  size?: 'sm' | 'md'
  variant?: 'filled' | 'bare'
}) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const variantClassName = emphasize
    ? 'border-slate-900 bg-slate-900 text-white hover:opacity-90 disabled:border-slate-400 disabled:bg-slate-400'
    : variant === 'bare'
      ? 'bg-transparent text-slate-500 hover:text-slate-900 disabled:opacity-30'
      : 'border-black/10 bg-white/70 text-slate-700 hover:bg-white disabled:opacity-40'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex ${sizeClass} items-center justify-center transition-all ${variant !== 'bare' ? 'rounded-full border' : ''} ${variantClassName}`}
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
  toolbarLeadingAddon,
  toolbarButtonVariant = 'filled',
  emojiTriggerVariant = 'filled',
  showCancelButton = true,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<TextSelectionRange | null>(null)
  const iconSize = buttonSize === 'sm' ? 11 : 13
  const currentLength = value.length
  const remainingLength = typeof maxLength === 'number' ? Math.max(maxLength - currentLength, 0) : null

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

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
        onChange={(event) => onChange(typeof maxLength === 'number' ? event.target.value.slice(0, maxLength) : event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`${minHeightClassName} w-full resize-none overflow-hidden rounded-[18px] border border-black/10 bg-white/55 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-500/70 focus:border-primary/30 focus:ring-2 focus:ring-primary/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      />
      {typeof maxLength === 'number' ? (
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground/80">
          <span>最多 {maxLength} 字</span>
          <span className={remainingLength !== null && remainingLength <= Math.min(20, Math.floor(maxLength * 0.12)) ? 'text-amber-600' : undefined}>
            已输入 {currentLength} 字，还剩 {remainingLength} 字
          </span>
        </div>
      ) : null}
      <div className={shellClassName}>
        <EditorActionBar
          noWrap
          className={['border-t-0', toolbarClassName].join(' ')}
          leading={(
            <>
              {toolbarLeadingAddon}
              <EmojiPickerButton
                size={buttonSize}
                panelAlign="start"
                triggerVariant={emojiTriggerVariant}
                onSelect={(emoji) => withSelection((text, start, end) => {
                  const result = insertTextAtSelection(text, emoji, start, end)
                  return {
                    value: result.value,
                    selection: {
                      start: result.selectionStart,
                      end: result.selectionEnd,
                    },
                  }
                })}
              />
              <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection(insertChecklistSyntax)} label="插入 checklist">
                <ListTodo size={iconSize} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '**'))} label="加粗">
                <Bold size={iconSize} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '*'))} label="斜体">
                <Italic size={iconSize} strokeWidth={1.8} />
              </ToolbarIconButton>
              <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '=='))} label="高亮">
                <Highlighter size={iconSize} strokeWidth={1.8} />
              </ToolbarIconButton>
            </>
          )}
          trailing={(
            <>
              {onCancel && showCancelButton ? (
                <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={onCancel} label="取消编辑">
                  <X size={iconSize} strokeWidth={1.8} />
                </ToolbarIconButton>
              ) : null}
              <ToolbarIconButton size={buttonSize} onClick={onSave} label={isSaving ? '保存中' : saveLabel} disabled={isSaving || saveDisabled} emphasize>
                <Check size={iconSize} strokeWidth={2} />
              </ToolbarIconButton>
            </>
          )}
        />
      </div>
    </div>
  )
}