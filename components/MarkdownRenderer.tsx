import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import Image from 'next/image'
import 'highlight.js/styles/github.css'

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
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
          p: ({ children }) => {
            paragraphCount++;
            if (skipFirstParagraph && paragraphCount === 1) {
              return null;
            }
            return <p>{children}</p>;
          },
          img: ({ ...props }) => {
            // Decodes the URL to handle special characters correctly
            const url = typeof props.src === 'string' ? props.src : ''
            const src = url ? decodeURIComponent(url) : ''
            return (
              <span className="relative block aspect-video w-full my-4 overflow-hidden rounded-xl bg-muted border border-border/50">
                <Image
                  src={src}
                  alt={props.alt || ''}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                  className="object-cover transition-opacity duration-300"
                />
              </span>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
