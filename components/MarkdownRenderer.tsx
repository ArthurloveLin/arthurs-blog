import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeKatex from 'rehype-katex'
import { visit } from 'unist-util-visit'
import type { Root, Element } from 'hast'
import Image from 'next/image'
import CodeBlock from '@/components/CodeBlock'
import 'katex/dist/katex.min.css'

// Preserve the original fence language identifier before rehype-highlight normalises
// aliases (e.g. 'js' → 'javascript'). CodeBlock reads data-lang to show the label
// exactly as written in the markdown source, matching Obsidian's display convention.
function rehypePreserveLang() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'code') return
      const classes = Array.isArray(node.properties?.className)
        ? (node.properties.className as string[])
        : []
      const langClass = classes.find(c => typeof c === 'string' && c.startsWith('language-'))
      if (langClass) {
        node.properties = node.properties ?? {}
        node.properties['data-lang'] = langClass.slice('language-'.length)
      }
    })
  }
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const CSS_VAR_COLOR_RE = /^var\(--[a-zA-Z0-9_-]+\)$/
const NAMED_COLOR_RE = /^[a-zA-Z]{3,20}$/

function isSafeCaptionColor(value: string) {
  const trimmed = value.trim()
  return HEX_COLOR_RE.test(trimmed) || CSS_VAR_COLOR_RE.test(trimmed) || NAMED_COLOR_RE.test(trimmed)
}

function parseImageCaption(rawTitle: string | null | undefined): { text: string; color: string | null } | null {
  const normalized = rawTitle?.trim()
  if (!normalized) return null

  const colorSeparatorIndex = normalized.lastIndexOf('||')
  if (colorSeparatorIndex > -1) {
    const text = normalized.slice(0, colorSeparatorIndex).trim()
    const color = normalized.slice(colorSeparatorIndex + 2).trim()
    if (text && isSafeCaptionColor(color)) {
      return { text, color }
    }
  }

  return { text: normalized, color: null }
}

function decodeIfEncoded(url: string) {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}

// Strip the first top-level paragraph from raw markdown.
// Any block element that would NOT render as a bare <p> is left untouched:
// blockquotes, ATX/setext headings, all list types (- * +), fenced (``` ~~~)
// and indented code blocks, tables, images, and raw HTML blocks.
function stripFirstParagraph(content: string): string {
  // Operate on the first non-blank line WITHOUT trimming leading whitespace,
  // so indented code blocks (4 spaces / tab) are detected correctly.
  const lines = content.split('\n')
  const firstNonBlankIdx = lines.findIndex(l => l.length > 0)
  if (firstNonBlankIdx === -1) return content
  const firstLine = lines[firstNonBlankIdx]
  const body = lines.slice(firstNonBlankIdx).join('\n')

  // ATX heading, blockquote, fenced code (``` or ~~~), table, image, list (- * +), HTML block
  if (/^[>#\-*+`~|!<]/.test(firstLine)) return body
  // Ordered list
  if (/^\d+[.)]\s/.test(firstLine)) return body
  // Indented code block (4 spaces or tab) — checked before trimming
  if (/^(?:    |\t)/.test(firstLine)) return body
  // Setext heading: text line immediately followed by === or --- underline
  const secondLine = lines[firstNonBlankIdx + 1] ?? ''
  if (/^[=\-]{2,}[ \t]*$/.test(secondLine)) return body

  // Strip the first paragraph (everything up to the first blank line)
  const idx = body.indexOf('\n\n')
  return idx === -1 ? '' : body.slice(idx).trimStart()
}

export default function MarkdownRenderer({
  content,
  skipFirstParagraph = false
}: {
  content: string;
  postId?: string;
  skipFirstParagraph?: boolean
}) {
  const processedContent = skipFirstParagraph ? stripFirstParagraph(content) : content

  return (
    <div className="prose prose-gray max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypePreserveLang, [rehypeHighlight, { detect: true }], rehypeSlug, rehypeKatex]}
        components={{
          p: ({ node, children }) => {
            // A paragraph wrapping only an image is a block figure, not a text
            // paragraph — drop the <p> wrapper (block inside inline is invalid HTML).
            const c = (node as unknown as { children?: Array<{ tagName?: string }> })?.children
            if (c?.length === 1 && c[0]?.tagName === 'img') {
              return <>{children}</>
            }
            return <p>{children}</p>;
          },
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table>{children}</table>
            </div>
          ),
          img: ({ ...props }) => {
            const url = typeof props.src === 'string' ? props.src : ''
            const src = url ? decodeIfEncoded(url) : ''
            const caption = parseImageCaption(typeof props.title === 'string' ? props.title : null)
            return (
              <figure className="my-5">
                <span className="relative block aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-muted">
                  <Image
                    src={src}
                    alt={props.alt || ''}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                    className="object-cover transition-opacity duration-300"
                  />
                </span>
                {caption ? (
                  <figcaption
                    className="mx-auto mt-2 max-w-[92%] text-center text-[0.82rem] font-normal leading-relaxed"
                    style={{ color: caption.color ?? 'var(--image-caption-color, #6b7280)' }}
                  >
                    {caption.text}
                  </figcaption>
                ) : null}
              </figure>
            )
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
