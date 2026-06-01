'use client'

import { useRef, useState, Children, isValidElement } from 'react'
import { Copy, Check } from 'lucide-react'

function extractLangInfo(children: React.ReactNode): { label: string | null } {
  const child = Children.toArray(children)[0]
  if (!isValidElement(child)) return { label: null }
  const props = child.props as { className?: string; 'data-lang'?: string }
  // Prefer the original fence identifier preserved before rehype-highlight normalises it
  if (props['data-lang']) return { label: props['data-lang'] }
  const match = (props.className ?? '').match(/\blanguage-(\S+)/)
  return { label: match ? match[1] : null }
}

export default function CodeBlock({ children }: { children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const { label } = extractLangInfo(children)

  const handleCopy = () => {
    const text = preRef.current?.textContent ?? ''
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="code-block-wrapper group">
      {/* Header: language label on the left, copy button on the right */}
      <div className="flex items-center justify-between px-3.5 pt-2 pb-0">
        <span className="select-none font-mono text-[10px] text-black/30 dark:text-white/30">
          {label ?? ' '}
        </span>
        <button
          onClick={handleCopy}
          aria-label="复制代码"
          className="flex items-center justify-center w-6 h-6 rounded-md
            bg-black/[0.06] hover:bg-black/[0.12] text-black/40 hover:text-black/70
            dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/50 dark:hover:text-white/90
            opacity-0 group-hover:opacity-100 focus-visible:opacity-100
            transition-all duration-150"
        >
          {copied
            ? <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" strokeWidth={2.5} />
            : <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
          }
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  )
}
