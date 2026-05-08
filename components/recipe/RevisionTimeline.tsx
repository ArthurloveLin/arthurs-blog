import type { RecipeRevision } from '@/lib/recipes'

interface Props {
  revisions: RecipeRevision[]
}

export default function RevisionTimeline({ revisions }: Props) {
  if (revisions.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'oklch(0.55 0.03 50)' }}>
        暂无修订记录
      </p>
    )
  }

  return (
    <ol style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', paddingLeft: 20 }}>
      {/* Timeline line */}
      <div style={{
        position: 'absolute',
        left: 5,
        top: 6,
        bottom: 6,
        width: 1,
        background: 'oklch(0.65 0.18 35 / 0.2)',
      }} />

      {revisions.map((rev) => (
        <li key={rev.id} style={{ position: 'relative' }}>
          {/* Dot */}
          <div style={{
            position: 'absolute',
            left: -20,
            top: 4,
            width: 11,
            height: 11,
            borderRadius: '50%',
            border: '2px solid oklch(0.65 0.18 35)',
            background: 'oklch(0.97 0.02 85)',
          }} />

          <p style={{
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.06em',
            color: 'oklch(0.65 0.18 35)',
            marginBottom: 3,
            lineHeight: 1,
          }}>
            v{rev.version}
            <span style={{ color: 'oklch(0.6 0.02 50)', marginLeft: 6 }}>
              {new Date(rev.created_at).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: 'oklch(0.4 0.03 50)' }}>
            {rev.change_summary}
          </p>
        </li>
      ))}
    </ol>
  )
}
