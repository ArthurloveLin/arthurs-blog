import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { AGENT_RUNTIME_CACHE_TAGS, getAgentRunTag, getAgentThreadTag } from '@/lib/agent-runtime/cache'
import { createAgentMessageForOwner, executeAgentRunForOwner, getAgentThreadBundleOrThrow } from '@/lib/agent-runtime/service'
import { AppError } from '@/lib/app-error'
import {
  asOptionalRecord,
  asOptionalString,
  asOptionalStringArray,
  handleApiError,
  readJsonBody,
  requireAdminUser,
} from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const bundle = await getAgentThreadBundleOrThrow({ threadId: id, ownerUserId: user.id })
    return NextResponse.json(bundle.messages)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const body = await readJsonBody(request)
    const role = asOptionalString(body.role, 'role') ?? 'user'
    const attachmentIds = asOptionalStringArray(body.attachmentIds, 'attachmentIds')
    const structuredContent = asOptionalRecord(body.structuredContent, 'structuredContent') ?? {}
    const textContent = asOptionalString(body.textContent, 'textContent')
    const autoRun = body.autoRun === true

    if (autoRun && role !== 'user') {
      throw new AppError(400, 'autoRun is only supported for user messages')
    }

    const message = await createAgentMessageForOwner({
      threadId: id,
      ownerUserId: user.id,
      role: role as 'system' | 'user' | 'assistant' | 'tool',
      textContent,
      structuredContent: {
        ...structuredContent,
        ...(attachmentIds && attachmentIds.length > 0 ? { attachmentIds } : {}),
      },
      sourceKind: autoRun ? 'manual' : 'manual',
    })

    revalidateTag(AGENT_RUNTIME_CACHE_TAGS.threads, 'max')
    revalidateTag(getAgentThreadTag(id), 'max')

    if (!autoRun) {
      return NextResponse.json({ message }, { status: 201 })
    }

    const runResult = await executeAgentRunForOwner({
      ownerUserId: user.id,
      threadId: id,
      messageId: message.id,
      attachmentIds,
      requestPayload: asOptionalRecord(body.requestPayload, 'requestPayload'),
    })

    revalidateTag(AGENT_RUNTIME_CACHE_TAGS.runs, 'max')
    revalidateTag(getAgentRunTag(runResult.run.id), 'max')

    return NextResponse.json(
      {
        message,
        run: runResult.run,
        assistantMessage: runResult.assistantMessage,
        draftPayload: runResult.parsed?.draftPayload ?? null,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}