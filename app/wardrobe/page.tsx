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
    <main className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
              ← 首页
            </Link>
            <h1 className="text-2xl font-bold text-foreground">👗 选衣记录</h1>
          </div>
          {isAdmin && (
            <Link
              href="/session/new"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              + 新建会话
            </Link>
          )}
        </div>

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
