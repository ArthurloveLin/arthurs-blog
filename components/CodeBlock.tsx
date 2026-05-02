'use client'

import { useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CodeBlock({ children }: { children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = preRef.current?.textContent ?? ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="code-block-wrapper relative group">
      <pre ref={preRef}>{children}</pre>
      <button
        onClick={handleCopy}
        aria-label="复制代码"
        className="absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-md
          bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/90
          opacity-0 group-hover:opacity-100 focus-visible:opacity-100
          transition-all duration-150"
      >
        {copied
          ? <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={2.5} />
          : <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
        }
      </button>
    </div>
  )
}
