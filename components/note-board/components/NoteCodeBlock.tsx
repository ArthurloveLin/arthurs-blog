'use client'

import { useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import langBash from 'highlight.js/lib/languages/bash'
import langC from 'highlight.js/lib/languages/c'
import langCpp from 'highlight.js/lib/languages/cpp'
import langCsharp from 'highlight.js/lib/languages/csharp'
import langCSS from 'highlight.js/lib/languages/css'
import langGo from 'highlight.js/lib/languages/go'
import langJava from 'highlight.js/lib/languages/java'
import langJS from 'highlight.js/lib/languages/javascript'
import langJSON from 'highlight.js/lib/languages/json'
import langMarkdown from 'highlight.js/lib/languages/markdown'
import langPython from 'highlight.js/lib/languages/python'
import langRuby from 'highlight.js/lib/languages/ruby'
import langRust from 'highlight.js/lib/languages/rust'
import langSQL from 'highlight.js/lib/languages/sql'
import langTS from 'highlight.js/lib/languages/typescript'
import langXML from 'highlight.js/lib/languages/xml'
import langYAML from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('javascript', langJS)
hljs.registerLanguage('typescript', langTS)
hljs.registerLanguage('python', langPython)
hljs.registerLanguage('bash', langBash)
hljs.registerLanguage('c', langC)
hljs.registerLanguage('cpp', langCpp)
hljs.registerLanguage('csharp', langCsharp)
hljs.registerLanguage('css', langCSS)
hljs.registerLanguage('go', langGo)
hljs.registerLanguage('java', langJava)
hljs.registerLanguage('json', langJSON)
hljs.registerLanguage('markdown', langMarkdown)
hljs.registerLanguage('ruby', langRuby)
hljs.registerLanguage('rust', langRust)
hljs.registerLanguage('sql', langSQL)
hljs.registerLanguage('xml', langXML)
hljs.registerLanguage('yaml', langYAML)

// GFM / Obsidian aliases
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' })
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
hljs.registerAliases(['py'], { languageName: 'python' })
hljs.registerAliases(['sh', 'shell', 'zsh'], { languageName: 'bash' })
hljs.registerAliases(['html', 'svg'], { languageName: 'xml' })
hljs.registerAliases(['yml'], { languageName: 'yaml' })
hljs.registerAliases(['cs'], { languageName: 'csharp' })
hljs.registerAliases(['rb'], { languageName: 'ruby' })
hljs.registerAliases(['rs'], { languageName: 'rust' })
hljs.registerAliases(['md', 'mdx'], { languageName: 'markdown' })

interface NoteCodeBlockProps {
  code: string
  lang: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function NoteCodeBlock({ code, lang }: NoteCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const { html, resolvedLang } = useMemo(() => {
    if (!code.trim()) return { html: escapeHtml(code), resolvedLang: '' }
    const normLang = lang.toLowerCase()
    try {
      if (normLang && hljs.getLanguage(normLang)) {
        const result = hljs.highlight(code, { language: normLang })
        return { html: result.value, resolvedLang: normLang }
      }
      const result = hljs.highlightAuto(code)
      return { html: result.value, resolvedLang: result.language ?? '' }
    } catch {
      return { html: escapeHtml(code), resolvedLang: '' }
    }
  }, [code, lang])

  const labelText = lang || resolvedLang

  const handleCopy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group my-2.5 w-full overflow-hidden rounded-[10px] bg-black/[0.05] dark:bg-white/[0.06]">
      <div className="flex items-center justify-between px-3.5 pb-0 pt-2">
        <span className="select-none font-mono text-[10px] text-slate-400/80 dark:text-slate-300/80">
          {labelText || ' '}
        </span>
        <button
          type="button"
          aria-label="复制代码"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleCopy}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/[0.06] text-slate-400 opacity-0 transition-opacity duration-150 hover:bg-black/10 hover:text-slate-600 group-hover:opacity-100 focus-visible:opacity-100 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:text-slate-100"
        >
          {copied
            ? <Check size={12} strokeWidth={2.5} className="text-green-500" />
            : <Copy size={12} strokeWidth={1.8} />}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-0 font-mono text-[0.85em] leading-[1.5] [scrollbar-color:rgba(15,23,42,0.15)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-track]:bg-transparent">
        <code
          className="hljs block whitespace-pre px-[14px] pb-3 pt-1.5 dark:invert dark:hue-rotate-180"
          style={{ background: 'transparent' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  )
}
