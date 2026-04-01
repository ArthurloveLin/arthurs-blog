import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

interface Session {
  id: string
  title: string | null
  note: string | null
  token: string
  budget: number | null
  created_at: string
  items: [{ count: number }]
}

export default async function Home() {
  const { data: sessions, error } = await supabaseAdmin
    .from('sessions')
    .select('*, items(count)')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">👗 选衣记录</h1>
          <Link
            href="/session/new"
            className="bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-pink-600 transition-colors"
          >
            + 新建会话
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-4">
            加载失败：{error.message}
          </div>
        )}

        {!error && sessions?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🛍️</div>
            <p>还没有选衣会话</p>
            <p className="text-sm mt-1">点击右上角「新建会话」开始</p>
          </div>
        )}

        <div className="space-y-3">
          {(sessions as Session[] ?? []).map((session) => {
            const count = session.items?.[0]?.count ?? 0
            const date = new Date(session.created_at).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
            return (
              <Link
                key={session.id}
                href={`/session/${session.token}`}
                className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-800 truncate">
                      {session.title || '无标题会话'}
                    </h2>
                    {session.note && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{session.note}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm text-gray-500">{count} 件</span>
                    {session.budget && (
                      <p className="text-xs text-gray-400">预算 ¥{session.budget}</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
