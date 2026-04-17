'use server'

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { verifyTurnstile } from '@/lib/turnstile'

export async function login(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const turnstileToken = formData.get('cf-turnstile-response') as string

  // 1. 验证 Turnstile
  const isVerified = await verifyTurnstile(turnstileToken)
  if (!isVerified) {
    return { error: '人机验证失败，请重试' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const redirectTo = formData.get('redirectTo') as string || '/'
  redirect(redirectTo)
}
