import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { AGENT_RUNTIME_CACHE_TAGS } from '@/lib/agent-runtime/cache'
import { createAgentThreadForOwner, listAgentThreadsForOwner } from '@/lib/agent-runtime/service'
import {
  asOptionalRecord,
  asOptionalString,
  asRequiredString,
  getOptionalSearchParam,
  getPositiveIntegerSearchParam,
  handleApiError,
  readJsonBody,
  requireAdminUser,
} from '@/lib/server-api'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdminUser()
    const appKey = getOptionalSearchParam(request, 'appKey') ?? undefined
    const taskKey = getOptionalSearchParam(request, 'taskKey') ?? undefined
    const limit = getPositiveIntegerSearchParam(request, 'limit', 20, 100)

    const threads = await listAgentThreadsForOwner({
      ownerUserId: user.id,
      appKey,
      taskKey,
      limit,
    })

    return NextResponse.json(threads)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser()
    const body = await readJsonBody(request)
    const thread = await createAgentThreadForOwner({
      ownerUserId: user.id,
      appKey: asRequiredString(body.appKey, 'appKey'),
      taskKey: asRequiredString(body.taskKey, 'taskKey'),
      title: asOptionalString(body.title, 'title'),
      metadata: asOptionalRecord(body.metadata, 'metadata'),
    })

    revalidateTag(AGENT_RUNTIME_CACHE_TAGS.threads, 'max')
    return NextResponse.json(thread, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}