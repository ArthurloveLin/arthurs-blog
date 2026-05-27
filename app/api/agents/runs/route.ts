import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { AGENT_RUNTIME_CACHE_TAGS, getAgentRunTag, getAgentThreadTag } from '@/lib/agent-runtime/cache'
import { executeAgentRunForOwner, listAgentRunsForOwner } from '@/lib/agent-runtime/service'
import {
  asOptionalRecord,
  asOptionalString,
  asOptionalStringArray,
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
    const threadId = getOptionalSearchParam(request, 'threadId') ?? undefined
    const limit = getPositiveIntegerSearchParam(request, 'limit', 20, 100)
    const runs = await listAgentRunsForOwner({ ownerUserId: user.id, threadId, limit })
    return NextResponse.json(runs)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser()
    const body = await readJsonBody(request)
    const threadId = asRequiredString(body.threadId, 'threadId')
    const runResult = await executeAgentRunForOwner({
      ownerUserId: user.id,
      threadId,
      messageId: asOptionalString(body.messageId, 'messageId') ?? undefined,
      attachmentIds: asOptionalStringArray(body.attachmentIds, 'attachmentIds'),
      requestPayload: asOptionalRecord(body.requestPayload, 'requestPayload'),
    })

    revalidateTag(AGENT_RUNTIME_CACHE_TAGS.runs, 'max')
    revalidateTag(getAgentThreadTag(threadId), 'max')
    revalidateTag(getAgentRunTag(runResult.run.id), 'max')

    return NextResponse.json(runResult, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}