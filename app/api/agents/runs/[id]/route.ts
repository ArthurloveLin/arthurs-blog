import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { AGENT_RUNTIME_CACHE_TAGS, getAgentRunTag, getAgentThreadTag } from '@/lib/agent-runtime/cache'
import { getAgentRunDetailOrThrow, retryAgentRunForOwner } from '@/lib/agent-runtime/service'
import { AppError } from '@/lib/app-error'
import { handleApiError, readOptionalJsonBody, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const detail = await getAgentRunDetailOrThrow({ runId: id, ownerUserId: user.id })
    return NextResponse.json(detail)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const body = await readOptionalJsonBody(request)
    const action = typeof body.action === 'string' ? body.action.trim() : 'retry'

    if (action !== 'retry') {
      throw new AppError(400, 'Only retry action is supported')
    }

    const result = await retryAgentRunForOwner({ runId: id, ownerUserId: user.id })
    revalidateTag(AGENT_RUNTIME_CACHE_TAGS.runs, 'max')
    revalidateTag(getAgentRunTag(result.run.id), 'max')
    revalidateTag(getAgentThreadTag(result.run.thread_id), 'max')

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}