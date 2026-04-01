import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 客户端用（浏览器）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 服务端用（API Route），拥有完整权限
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
