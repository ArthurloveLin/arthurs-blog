import { NextResponse } from 'next/server'
import { getCurrentUser, getUserRole } from '@/lib/auth'

export async function GET() {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()])
  return NextResponse.json(
    {
      role,
      email: user?.email ?? null,
      display_name: user?.user_metadata?.display_name ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
