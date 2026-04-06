'use client'

import { useActionState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from 'next-view-transitions'
import { login } from './actions'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'

  const [state, formAction, pending] = useActionState(login, null)

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200/60 dark:border-zinc-800 p-8">
          <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-white mb-1">登录</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
            还没有账号？
            <Link
              href={`/auth/register?redirect=${encodeURIComponent(redirectTo)}`}
              className="text-pink-500 hover:text-pink-600 ml-1"
            >
              注册
            </Link>
          </p>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                邮箱
              </label>
              <input
                type="email"
                name="email"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[#1D1D1F] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                密码
              </label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[#1D1D1F] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-500">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2 px-4 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
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
