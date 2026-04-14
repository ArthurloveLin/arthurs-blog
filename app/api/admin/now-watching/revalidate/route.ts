import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { isAdminRequest } from '@/lib/auth'

export async function POST() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  revalidateTag('now-watching', 'max')
  revalidatePath('/now-watching')

  return NextResponse.json({ success: true })
}
