import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserRole } from '@/lib/auth'
import SessionList from '@/components/SessionList'

export default async function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const { archived } = await searchParams
  const showArchived = archived === '1'
  const isAdmin = (await getUserRole()) === 'admin'

  const { data: sessions, error } = await supabaseAdmin
    .from('sessions')
    .select('*, items(count)')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
              ← 首页
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">👗 选衣记录</h1>
          </div>
          {isAdmin && (
            <Link
              href="/session/new"
              className="bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-pink-600 transition-colors"
            >
              + 新建会话
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-4">
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
