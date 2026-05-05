import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { isAdminRequest } from '@/lib/auth'
import { purgeCloudflareFiles } from '@/lib/cloudflare-cache'

export async function POST(request: Request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  revalidateTag('now-watching', 'max')
  revalidatePath('/now-watching')
  await purgeCloudflareFiles(new URL(request.url).origin, ['/now-watching'])

  return NextResponse.json({ success: true })
}
