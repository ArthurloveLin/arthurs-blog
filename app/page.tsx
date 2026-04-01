import { supabaseAdmin } from '@/lib/supabase'

export default async function Home() {
  const { data, error } = await supabaseAdmin.from('sessions').select('*')

  return (
    <main>
      <p>连接测试：{error ? '失败 ❌ ' + error.message : '成功 ✅'}</p>
      <p>会话数量：{data?.length ?? 0}</p>
    </main>
  )
}
