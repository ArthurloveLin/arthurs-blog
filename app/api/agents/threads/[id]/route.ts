import { NextRequest, NextResponse } from 'next/server'

import { getAgentThreadBundleOrThrow } from '@/lib/agent-runtime/service'
import { handleApiError, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const bundle = await getAgentThreadBundleOrThrow({
      threadId: id,
      ownerUserId: user.id,
    })

    return NextResponse.json(bundle)
  } catch (error) {
    return handleApiError(error)
  }
}