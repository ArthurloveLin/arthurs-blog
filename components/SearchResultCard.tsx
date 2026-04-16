import Link from 'next/link'
import { formatBlogPublishedDate } from '@/lib/date-format'
import { splitHighlightedText, type SearchMatchField } from '@/lib/blog-search'
import type { SearchPostResult } from '@/lib/blog'

interface SearchResultCardProps {
  result: SearchPostResult
  query: string
  compact?: boolean
  onNavigate?: () => void
}

const fieldLabelMap: Record<SearchMatchField, string> = {
  title: '标题',
  summary: '摘要',
  tags: '标签',
  category: '分类',
  content: '正文',
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const segments = splitHighlightedText(text, query)

  return (
    <>
      {segments.map((segment, index) => (
        segment.match ? (
          <mark
            key={`${segment.text}-${index}`}
            className="rounded-[0.35rem] bg-primary/14 px-0.5 text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        )
      ))}
    </>
  )
}

export default function SearchResultCard({ result, query, compact = false, onNavigate }: SearchResultCardProps) {
  const publishedDate = result.published_at ? formatBlogPublishedDate(result.published_at) : ''
  const matchedFields = result.matched_fields.slice(0, compact ? 2 : 4)

  return (
    <Link
      href={`/blog/${result.slug}`}
      onClick={onNavigate}
      className={[
        'group block rounded-[1.15rem] border border-border/70 bg-card/90 text-card-foreground transition duration-200',
        compact
          ? 'px-4 py-3 hover:bg-muted/60 hover:border-border'
          : 'px-5 py-5 shadow-[3px_5px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:shadow-[3px_8px_36px_rgba(0,0,0,0.12)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className={compact ? 'text-sm font-semibold leading-6 text-foreground' : 'text-xl font-semibold leading-8 text-foreground'}>
            <HighlightText text={result.title} query={query} />
          </h2>

          {(result.snippet || result.summary) ? (
            <p className={compact ? 'mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground' : 'mt-3 text-base leading-7 text-foreground/78'}>
              <HighlightText text={result.snippet || result.summary || ''} query={query} />
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {publishedDate ? <span className="font-mono tracking-[0.12em] uppercase">{publishedDate}</span> : null}
            {result.category ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground/75">
                <HighlightText text={result.category} query={query} />
              </span>
            ) : null}
            {result.tags.slice(0, compact ? 2 : 4).map((tag) => (
              <span key={tag} className="rounded-full bg-muted/75 px-2.5 py-1 text-[11px] text-foreground/70">
                #<HighlightText text={tag} query={query} />
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          {!compact ? (
            <span className="rounded-full border border-primary/18 bg-primary/6 px-3 py-1 text-[11px] font-medium text-primary/80">
              相关度 {(result.rank || 0).toFixed(1)}
            </span>
          ) : null}
          <div className="flex flex-wrap justify-end gap-1.5">
            {matchedFields.map((field) => (
              <span key={field} className="rounded-full border border-border bg-background/70 px-2 py-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {fieldLabelMap[field]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}