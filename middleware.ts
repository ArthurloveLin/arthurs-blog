import { NextResponse, type NextRequest } from 'next/server'

// 自定义域名 api.arthurlovegrace.top 在 Edge sandbox 中不可达，
// 在 middleware 里调用 supabase.auth.getUser() 会导致 Web Lock 竞争损坏 auth token。
// 此 middleware 仅作路由占位，token 刷新由各 Server Action / API Route 自行处理。
export function middleware(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    // 跳过静态文件和 _next 内部路由
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
