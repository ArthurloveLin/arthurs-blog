import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { CALORIE_CACHE_TAGS, getCalorieWorkspaceTag } from '@/lib/calorie/cache'
import { postCalorieWorkspaceMessage } from '@/lib/calorie/service'
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

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const body = await readJsonBody(request)
    const attachmentIds = asOptionalStringArray(body.attachmentIds, 'attachmentIds')
    const structuredContent = asOptionalRecord(body.structuredContent, 'structuredContent') ?? {}

    const result = await postCalorieWorkspaceMessage({
      ownerUserId: user.id,
      workspaceId: id,
      textContent: asOptionalString(body.textContent, 'textContent'),
      structuredContent: {
        ...structuredContent,
        ...(attachmentIds && attachmentIds.length > 0 ? { attachmentIds } : {}),
      },
      attachmentIds,
      requestPayload: asOptionalRecord(body.requestPayload, 'requestPayload'),
    })

    revalidateTag(CALORIE_CACHE_TAGS.workspaces, 'max')
    revalidateTag(getCalorieWorkspaceTag(id), 'max')
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}