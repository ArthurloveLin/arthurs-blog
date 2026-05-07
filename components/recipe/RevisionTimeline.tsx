import type { RecipeRevision } from '@/lib/recipes'

interface Props {
  revisions: RecipeRevision[]
}

export default function RevisionTimeline({ revisions }: Props) {
  if (revisions.length === 0) {
    return (
      <p className="text-[10px]" style={{ color: 'oklch(0.55 0.03 50)' }}>
        暂无修订记录
      </p>
    )
  }

  return (
    <ol className="space-y-2 relative before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-amber-800/20">
      {revisions.map((rev) => (
        <li key={rev.id} className="pl-4 relative">
          <div
            className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2"
            style={{
              borderColor: 'oklch(0.65 0.18 35)',
              background: 'oklch(0.97 0.02 85)',
            }}
          />
          <p
            className="text-[10px] font-mono leading-none mb-0.5"
            style={{ color: 'oklch(0.65 0.18 35)' }}
          >
            v{rev.version} ·{' '}
            {new Date(rev.created_at).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <p className="text-[10px] leading-snug" style={{ color: 'oklch(0.4 0.03 50)' }}>
            {rev.change_summary}
          </p>
        </li>
      ))}
    </ol>
  )
}
