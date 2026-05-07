import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'service-role-key-placeholder'

// 服务端专用（API Route / Server Component），拥有完整权限
// 不可在客户端导入，SUPABASE_SERVICE_ROLE_KEY 无 NEXT_PUBLIC_ 前缀
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
