'use client'

import { useRef, useState, Children, isValidElement } from 'react'
import { Copy, Check } from 'lucide-react'

function extractLanguage(children: React.ReactNode): string | null {
  const child = Children.toArray(children)[0]
  if (!isValidElement(child)) return null
  const className = (child.props as { className?: string }).className ?? ''
  const match = className.match(/\blanguage-(\S+)/)
  return match ? match[1] : null
}

export default function CodeBlock({ children }: { children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const lang = extractLanguage(children)

  const handleCopy = () => {
    const text = preRef.current?.textContent ?? ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="code-block-wrapper relative group">
      {lang && (
        <span className="absolute top-2.5 left-3 text-[0.7rem] font-mono leading-none select-none
          text-black/30 dark:text-white/30">
          {lang}
        </span>
      )}
      <pre ref={preRef}>{children}</pre>
      <button
        onClick={handleCopy}
        aria-label="复制代码"
        className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-md
          bg-black/6 hover:bg-black/12 text-black/40 hover:text-black/70
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
  )
}
