import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeKatex from 'rehype-katex'
import Image from 'next/image'
import CodeBlock from '@/components/CodeBlock'
import 'katex/dist/katex.min.css'

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

export default function MarkdownRenderer({
  content,
  skipFirstParagraph = false
}: {
  content: string;
  postId?: string;
  skipFirstParagraph?: boolean
}) {
  let paragraphCount = 0;

  return (
    <div className="prose prose-gray max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeHighlight, { detect: true }], rehypeSlug, rehypeKatex]}
        components={{
          p: ({ node, children }) => {
            // A paragraph wrapping only an image is a block figure, not a text
            // paragraph — skip the counter so skipFirstParagraph never hides it,
            // and drop the <p> wrapper (block inside inline is invalid HTML).
            const c = (node as unknown as { children?: Array<{ tagName?: string }> })?.children
            if (c?.length === 1 && c[0]?.tagName === 'img') {
              return <>{children}</>
            }
            paragraphCount++;
            if (skipFirstParagraph && paragraphCount === 1) {
              return null;
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
        {content}
      </ReactMarkdown>
    </div>
  )
}
