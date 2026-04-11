import { NextResponse, type NextRequest } from 'next/server'

// 自定义域名 api.arthurlovegrace.top 在 Edge sandbox 中不可达，
// 在 middleware 里调用 supabase.auth.getUser() 会导致 Web Lock 竞争损坏 auth token。
// 此 proxy 仅作路由占位，token 刷新由各 Server Action / API Route 自行处理。
export function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    // 跳过全部 _next 内部路由与静态资源，避免干扰 dev HMR 和图片优化请求
    '/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
