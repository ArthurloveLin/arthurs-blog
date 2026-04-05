import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserRole } from '@/lib/auth'
import SessionList from '@/components/SessionList'

export const revalidate = 60

export default async function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const { archived } = await searchParams
  const showArchived = archived === '1'

  const [role, { data: sessions, error }] = await Promise.all([
    getUserRole(),
    supabaseAdmin
      .from('sessions')
      .select('*, items(count)')
      .order('created_at', { ascending: false })
  ])

  const isAdmin = role === 'admin'

  return (
    <main className="min-h-screen bg-background pb-12">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative border-b border-border bg-background overflow-hidden mb-8">
        {/* Blob Ornaments */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-blob-1 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:mix-blend-screen pointer-events-none"></div>
        <div className="absolute -top-10 right-1/4 w-72 h-72 bg-blob-2 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 dark:mix-blend-screen pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 lg:pt-14 lg:pb-12 z-10 flex flex-col items-center text-center">
          <Link href="/" className="self-start text-[11px] font-mono tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-2 uppercase">
            ← Home
          </Link>

          <h1 className="text-[2.5rem] lg:text-[3.5rem] font-bold tracking-tight leading-none text-foreground mb-4">
            Life <span className="text-gradient-primary">Lens</span>
          </h1>
          <p className="max-w-md text-sm text-muted-foreground leading-relaxed italic mb-8">
            "记录我们对事物的真实评价。告别碎片化的纠结，用灵活的模版和直观的对比，把每一次买衣服、吃大餐和去旅行，都沉淀为专属于我们的生活指南。"
          </p>

          {isAdmin && (
            <Link
              href="/session/new"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              + 开始评价会话
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-xl mb-4">
            加载失败：{error.message}
          </div>
        )}

        {!error && (
          <SessionList sessions={sessions ?? []} showArchived={showArchived} isAdmin={isAdmin} />
        )}
      </div>
    </main>
  )
}
