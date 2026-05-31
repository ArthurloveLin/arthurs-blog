'use client'

import { useActionState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from './actions'
import Turnstile from '@/components/Turnstile'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'

  const [state, formAction, pending] = useActionState(login, null)

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">登录</h1>
          <p className="text-sm text-muted-foreground mb-6">
            还没有账号？
            <Link
              href={`/auth/register?redirect=${encodeURIComponent(redirectTo)}`}
              className="text-primary hover:opacity-80 ml-1"
            >
              注册
            </Link>
          </p>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">
                邮箱
              </label>
              <input
                type="email"
                name="email"
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">
                密码
              </label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="flex justify-center">
              <Turnstile />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2 px-4 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
            >
              {pending ? '登录中…' : '登录'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
