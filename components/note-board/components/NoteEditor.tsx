'use client'

import { Bold, Check, Code, Heading2, Highlighter, Image as ImageIcon, Italic, Link2, ListTodo, Quote, Strikethrough, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import EmojiPickerButton from '@/components/emoji/EmojiPickerButton'
import EditorActionBar from '@/components/EditorActionBar'
import type { TextEditResult, TextSelectionRange } from '@/components/note-board/types'
import { clamp } from '@/components/note-board/utils/board'
import { insertTextAtSelection } from '@/lib/text-selection'
import { insertChecklistSyntax, insertLinePrefixSyntax, wrapSelectionWithSyntax } from '@/components/note-board/utils/editor'

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
  toolbarLeadingAddon?: ReactNode | ((insertAtCursor: (text: string) => void) => ReactNode)
  toolbarButtonVariant?: 'filled' | 'bare'
  emojiTriggerVariant?: 'filled' | 'bare'
  showCancelButton?: boolean
  counterVariant?: 'full' | 'compact'
  compactToolbar?: boolean
  splitToolbar?: boolean
}

/**
 * Props for NoteInlineEditor — the compact variant used for inline note editing
 * on sticky cards. Eliminates 7 boolean/variant props from the call site by
 * hardcoding the inline-specific configuration.
 *
 * @see architecture-avoid-boolean-props (vercel-composition-patterns)
 * @see patterns-explicit-variants (vercel-composition-patterns)
 */
export interface NoteInlineEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  saveLabel?: string
  isSaving: boolean
  onSave: () => void
  onCancel?: () => void
  saveDisabled?: boolean
  maxLength?: number
  autoFocus?: boolean
  minHeightClassName?: string
  shellClassName?: string
  toolbarClassName?: string
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
      className={`inline-flex shrink-0 ${sizeClass} items-center justify-center transition-all ${variant !== 'bare' ? 'rounded-full border' : ''} ${variantClassName}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/note-boards/upload-image', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? 'Upload failed')
  }
  const { url } = await response.json() as { url: string }
  return url
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
  counterVariant = 'full',
  compactToolbar = false,
  splitToolbar = false,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<TextSelectionRange | null>(null)
  const iconSize = buttonSize === 'sm' ? 11 : 13
  const currentLength = value.length
  const remainingLength = typeof maxLength === 'number' ? Math.max(maxLength - currentLength, 0) : null
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

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

  function insertAtCursor(text: string) {
    const textarea = textareaRef.current
    const pos = textarea ? textarea.selectionStart : value.length
    const result = insertTextAtSelection(value, text, pos, pos)
    commitTextEdit({ value: result.value, selection: { start: result.selectionStart, end: result.selectionEnd } })
  }

  function insertLinkTemplate() {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd } = textarea
    const selectedText = value.slice(selectionStart, selectionEnd)
    const insertion = selectedText ? `[${selectedText}](url)` : '[链接文字](url)'
    const result = insertTextAtSelection(value, insertion, selectionStart, selectionEnd)
    // Place cursor inside the URL part
    const urlStart = selectionStart + (selectedText ? selectedText.length : 5) + 3
    pendingSelectionRef.current = { start: urlStart, end: urlStart + 3 }
    onChange(typeof maxLength === 'number' ? result.value.slice(0, maxLength) : result.value)
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const url = await uploadImageFile(file)
      const textarea = textareaRef.current
      const pos = textarea ? textarea.selectionStart : value.length
      const insertion = `![](${url})`
      const result = insertTextAtSelection(value, insertion, pos, pos)
      const nextValue = typeof maxLength === 'number' ? result.value.slice(0, maxLength) : result.value
      pendingSelectionRef.current = { start: result.selectionStart, end: result.selectionEnd }
      onChange(nextValue)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '图片上传失败')
    } finally {
      setIsUploading(false)
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData.items
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) void handleImageUpload(file)
        return
      }
    }
  }

  function handleDrop(event: React.DragEvent<HTMLTextAreaElement>) {
    const file = event.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) {
      event.preventDefault()
      void handleImageUpload(file)
    }
  }

  function handleImageButtonClick() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) void handleImageUpload(file)
    }
    input.click()
  }

  const formattingButtons = (
    <>
      <EmojiPickerButton
        size={buttonSize}
        panelAlign="start"
        triggerVariant={emojiTriggerVariant}
        onSelect={(emoji) => withSelection((text, start, end) => {
          const result = insertTextAtSelection(text, emoji, start, end)
          return { value: result.value, selection: { start: result.selectionStart, end: result.selectionEnd } }
        })}
      />
      <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection(insertChecklistSyntax)} label="插入 checklist">
        <ListTodo size={iconSize} strokeWidth={1.8} />
      </ToolbarIconButton>
      <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '**'))} label="加粗">
        <Bold size={iconSize} strokeWidth={1.8} />
      </ToolbarIconButton>
      {!compactToolbar ? (
        <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '*'))} label="斜体">
          <Italic size={iconSize} strokeWidth={1.8} />
        </ToolbarIconButton>
      ) : null}
      <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '=='))} label="高亮">
        <Highlighter size={iconSize} strokeWidth={1.8} />
      </ToolbarIconButton>
      <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => {
        const isMultiline = text.slice(start, end).includes('\n')
        if (isMultiline) return wrapSelectionWithSyntax(text, start, end, '```\n', '\n```')
        return wrapSelectionWithSyntax(text, start, end, '`')
      })} label="插入代码">
        <Code size={iconSize} strokeWidth={1.8} />
      </ToolbarIconButton>
      {!compactToolbar ? (
        <>
          <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => wrapSelectionWithSyntax(text, start, end, '~~'))} label="删除线">
            <Strikethrough size={iconSize} strokeWidth={1.8} />
          </ToolbarIconButton>
          <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => insertLinePrefixSyntax(text, start, end, '## '))} label="标题 H2">
            <Heading2 size={iconSize} strokeWidth={1.8} />
          </ToolbarIconButton>
          <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={() => withSelection((text, start, end) => insertLinePrefixSyntax(text, start, end, '> '))} label="引用块">
            <Quote size={iconSize} strokeWidth={1.8} />
          </ToolbarIconButton>
          <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={insertLinkTemplate} label="插入链接">
            <Link2 size={iconSize} strokeWidth={1.8} />
          </ToolbarIconButton>
          <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={handleImageButtonClick} disabled={isUploading} label="上传图片">
            <ImageIcon size={iconSize} strokeWidth={1.8} />
          </ToolbarIconButton>
        </>
      ) : null}
    </>
  )

  const actionButtons = (
    <>
      {onCancel && showCancelButton ? (
        <ToolbarIconButton size={buttonSize} variant={toolbarButtonVariant} onClick={onCancel} label="取消编辑">
          <X size={iconSize} strokeWidth={1.8} />
        </ToolbarIconButton>
      ) : null}
      <ToolbarIconButton size={buttonSize} onClick={onSave} label={isSaving ? '保存中' : saveLabel} disabled={isSaving || saveDisabled || isUploading} emphasize>
        <Check size={iconSize} strokeWidth={2} />
      </ToolbarIconButton>
    </>
  )

  const resolvedLeadingAddon = typeof toolbarLeadingAddon === 'function'
    ? toolbarLeadingAddon(insertAtCursor)
    : toolbarLeadingAddon

  return (
    <div className="w-full min-w-0 max-w-full space-y-3">
      <div className="grid w-full min-w-0 max-w-full">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(typeof maxLength === 'number' ? event.target.value.slice(0, maxLength) : event.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={1}
          disabled={isUploading}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
          className={`${minHeightClassName} col-start-1 row-start-1 w-full min-w-0 max-w-full resize-none overflow-hidden rounded-[18px] border border-black/10 bg-white/55 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-500/70 focus:border-primary/30 focus:ring-2 focus:ring-primary/20 disabled:opacity-60 [overflow-wrap:anywhere] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        />
        <div
          className={`${minHeightClassName} col-start-1 row-start-1 invisible pointer-events-none w-full min-w-0 max-w-full whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6 [overflow-wrap:anywhere]`}
          aria-hidden="true"
        >
          {value + (value.endsWith('\n') ? ' ' : '')}
        </div>
      </div>

      {isUploading ? (
        <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
          图片上传中…
        </div>
      ) : null}
      {uploadError ? (
        <p className="px-1 text-[11px] text-rose-600">{uploadError}</p>
      ) : null}

      {typeof maxLength === 'number' ? (
        counterVariant === 'full' ? (
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground/80">
            <span>最多 {maxLength} 字</span>
            <span className={remainingLength !== null && remainingLength <= Math.min(200, Math.floor(maxLength * 0.05)) ? 'text-amber-600' : undefined}>
              已输入 {currentLength} 字，还剩 {remainingLength} 字
            </span>
          </div>
        ) : (
          <div className="-mt-1.5 flex justify-end px-2 text-[10px] text-slate-400/80">
            <span className={remainingLength !== null && remainingLength <= Math.min(200, Math.floor(maxLength * 0.05)) ? 'font-bold text-amber-600' : undefined}>
              剩 {remainingLength} 字
            </span>
          </div>
        )
      ) : null}

      <div className={["w-full min-w-0 max-w-full", shellClassName].join(' ')}>
        {splitToolbar ? (
          // Split layout: formatting row (scrollable) + action row always visible
          <>
            <div className={`flex flex-nowrap items-center gap-1.5 overflow-x-auto ${toolbarClassName} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
              {resolvedLeadingAddon}
              {formattingButtons}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
              {actionButtons}
            </div>
          </>
        ) : (
          <>
            {/* Mobile: formatting tools row + actions row stacked */}
            <div className="sm:hidden">
              <div className={`flex flex-nowrap items-center gap-1.5 overflow-x-auto ${toolbarClassName} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                {resolvedLeadingAddon}
                {formattingButtons}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
                {actionButtons}
              </div>
            </div>
            {/* Desktop: original single-row layout */}
            <div className="hidden sm:block">
              <EditorActionBar
                noWrap
                className={['border-t-0', toolbarClassName].join(' ')}
                leading={<>{resolvedLeadingAddon}{formattingButtons}</>}
                trailing={actionButtons}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Explicit variant of NoteEditor for inline editing on sticky note cards.
 *
 * Hardcodes the 7 variant-specific props (buttonSize, toolbarButtonVariant,
 * emojiTriggerVariant, showCancelButton, counterVariant, compactToolbar,
 * splitToolbar) so callers never need to pass them.
 *
 * @see architecture-avoid-boolean-props (vercel-composition-patterns)
 * @see patterns-explicit-variants (vercel-composition-patterns)
 */
export function NoteInlineEditor({
  value,
  onChange,
  placeholder = '直接修改这张便签的原始文本，checklist 状态也在这里编辑。',
  saveLabel = '保存',
  isSaving,
  onSave,
  onCancel,
  saveDisabled = false,
  maxLength,
  autoFocus = true,
  minHeightClassName = 'min-h-0',
  shellClassName = 'w-full max-w-full overflow-hidden rounded-[14px] border border-black/10 bg-white/30',
  toolbarClassName = 'px-2 py-1.5 text-[10px] text-slate-700',
}: NoteInlineEditorProps) {
  return (
    <NoteEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      saveLabel={saveLabel}
      isSaving={isSaving}
      onSave={onSave}
      onCancel={onCancel}
      saveDisabled={saveDisabled}
      maxLength={maxLength}
      minHeightClassName={minHeightClassName}
      shellClassName={shellClassName}
      toolbarClassName={toolbarClassName}
      buttonSize="sm"
      toolbarButtonVariant="bare"
      emojiTriggerVariant="bare"
      showCancelButton={false}
      counterVariant="compact"
      compactToolbar
      splitToolbar
      autoFocus={autoFocus}
    />
  )
}
