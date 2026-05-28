'use client'

import { Check } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_NOTE_PRIORITY, NOTE_PRIORITY_META, NOTE_PRIORITY_VALUES, type NotePriority } from '@/lib/note-priority'

interface PriorityPickerSharedProps {
  value?: NotePriority
  onChange?: (value: NotePriority) => void
  disabled?: boolean
  menuAlign?: 'start' | 'end'
  menuDirection?: 'up' | 'down'
  rootClassName?: string
  menuClassName?: string
}

interface PriorityDotPickerProps extends PriorityPickerSharedProps {
  buttonClassName?: string
  dotClassName?: string
}

interface PriorityTapePickerProps extends PriorityPickerSharedProps {
  buttonClassName?: string
}

interface PriorityPickerFrameProps extends PriorityPickerSharedProps {
  buttonClassName?: string
  dotClassName?: string
  trigger: 'dot' | 'tape'
}

function PriorityPickerFrame({
  value = DEFAULT_NOTE_PRIORITY,
  onChange,
  disabled = false,
  menuAlign = 'end',
  menuDirection = 'down',
  buttonClassName,
  rootClassName,
  menuClassName,
  dotClassName,
  trigger,
}: PriorityPickerFrameProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isInteractive = typeof onChange === 'function' && !disabled
  const currentMeta = NOTE_PRIORITY_META[value]

  const updateMenuPosition = useCallback(() => {
    const triggerElement = triggerRef.current
    const menuElement = menuRef.current

    if (!triggerElement || !menuElement) return

    const triggerRect = triggerElement.getBoundingClientRect()
    const menuRect = menuElement.getBoundingClientRect()
    const padding = 8
    let left = menuAlign === 'start' ? triggerRect.left : triggerRect.right - menuRect.width
    let top = menuDirection === 'up'
      ? triggerRect.top - menuRect.height - padding
      : triggerRect.bottom + padding

    if (left < padding) {
      left = padding
    } else if (left + menuRect.width > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - menuRect.width - padding)
    }

    if (top < padding) {
      top = triggerRect.bottom + padding
    }

    if (top + menuRect.height > window.innerHeight - padding) {
      top = Math.max(padding, triggerRect.top - menuRect.height - padding)
    }

    setMenuStyle({ left, top, position: 'fixed', zIndex: 1000 })
  }, [menuAlign, menuDirection])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    const frame = window.requestAnimationFrame(updateMenuPosition)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen, updateMenuPosition])

  function handleToggle() {
    if (!isInteractive) return
    setIsOpen((current) => !current)
  }

  function handleSelect(nextValue: NotePriority) {
    if (!isInteractive) return
    setIsOpen(false)
    if (nextValue !== value) {
      onChange(nextValue)
    }
  }

  const triggerClassName = trigger === 'tape'
    ? 'inline-flex h-[26px] w-[52px] items-center justify-center rounded-[2px] border border-white/20 shadow-[0_1px_0_rgba(255,255,255,0.32)_inset,0_2px_5px_rgba(15,23,42,0.13)] disabled:cursor-default disabled:opacity-100'
    : 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white/42 transition hover:-translate-y-0.5 hover:bg-white/58 disabled:cursor-default disabled:opacity-100'

  return (
    <div
      ref={rootRef}
      className={['relative inline-flex', rootClassName].filter(Boolean).join(' ')}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={currentMeta.label}
        title={isInteractive ? `${currentMeta.label}，点击切换` : currentMeta.label}
        disabled={disabled}
        onClick={handleToggle}
        className={[triggerClassName, buttonClassName].filter(Boolean).join(' ')}
        style={trigger === 'tape'
          ? {
              backgroundColor: currentMeta.color,
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.10) 45%, rgba(0,0,0,0.05) 100%)',
            }
          : undefined}
      >
        {trigger === 'tape' ? <span className="sr-only">{currentMeta.label}</span> : (
          <span
            aria-hidden
            className={['h-2.5 w-2.5 rounded-full shadow-[0_0_0_1px_rgba(15,23,42,0.08)]', dotClassName].filter(Boolean).join(' ')}
            style={{ backgroundColor: currentMeta.color }}
          />
        )}
      </button>

      {isOpen ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle ?? { position: 'fixed', left: -9999, top: -9999, zIndex: 90 }}
          className={[
            'rounded-[18px] border border-black/10 bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.16)]',
            menuClassName,
          ].filter(Boolean).join(' ')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            {[...NOTE_PRIORITY_VALUES].reverse().map((option) => {
              const meta = NOTE_PRIORITY_META[option]
              const active = option === value

              return (
                <button
                  key={option}
                  type="button"
                  aria-label={meta.label}
                  title={meta.label}
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 transition hover:-translate-y-0.5"
                  style={{
                    backgroundColor: active ? meta.tint : 'rgba(255,255,255,0.86)',
                    boxShadow: active ? `0 0 0 1px ${meta.ring}` : 'none',
                  }}
                  onClick={() => handleSelect(option)}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full shadow-[0_0_0_1px_rgba(15,23,42,0.08)]"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="sr-only">{meta.label}</span>
                  </span>
                  {active ? <Check size={10} strokeWidth={2.6} className="absolute text-slate-900" /> : null}
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

export function PriorityDotPicker(props: PriorityDotPickerProps) {
  return <PriorityPickerFrame {...props} trigger="dot" />
}

export function PriorityTapePicker(props: PriorityTapePickerProps) {
  return <PriorityPickerFrame {...props} trigger="tape" />
}

export const PriorityPicker = {
  Dot: PriorityDotPicker,
  Tape: PriorityTapePicker,
}